import db from "../database/index.js";
import Stripe from "stripe";
import dotenv from "dotenv";

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Função auxiliar para converter timestamp do Stripe para Date de forma segura
const stripeTimestampToDate = (timestamp) => {
  if (!timestamp || isNaN(timestamp)) {
    return null;
  }
  return new Date(timestamp * 1000);
};

// Função auxiliar para calcular data de fim baseada no intervalo do plano
const calculatePeriodEnd = (startTimestamp, interval, intervalCount) => {
  if (!startTimestamp || !interval) {
    return null;
  }
  
  const startDate = new Date(startTimestamp * 1000);
  const endDate = new Date(startDate);
  
  switch (interval) {
    case 'day':
      endDate.setDate(endDate.getDate() + (intervalCount || 1));
      break;
    case 'week':
      endDate.setDate(endDate.getDate() + (7 * (intervalCount || 1)));
      break;
    case 'month':
      endDate.setMonth(endDate.getMonth() + (intervalCount || 1));
      break;
    case 'year':
      endDate.setFullYear(endDate.getFullYear() + (intervalCount || 1));
      break;
    default:
      return null;
  }
  
  return endDate;
};

// Função auxiliar para obter datas de período da subscription
const getSubscriptionPeriodDates = (subscription) => {
  // Se está em trial, usar trial_start e trial_end (7 dias)
  if (subscription.status === "trialing") {
    // Prioridade: usar trial_end que tem exatamente 7 dias
    if (subscription.trial_end) {
      const trialStart = subscription.trial_start || subscription.current_period_start || subscription.created;
      return {
        start: stripeTimestampToDate(trialStart),
        end: stripeTimestampToDate(subscription.trial_end),
      };
    }
    // Fallback: calcular 7 dias a partir de trial_start
    if (subscription.trial_start) {
      const startDate = stripeTimestampToDate(subscription.trial_start);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 7); // 7 dias de trial
      return {
        start: startDate,
        end: endDate,
      };
    }
    // Último fallback: calcular 7 dias a partir de created/current_period_start
    const startTimestamp = subscription.current_period_start || subscription.created;
    if (startTimestamp) {
      const startDate = stripeTimestampToDate(startTimestamp);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 7); // 7 dias de trial
      return {
        start: startDate,
        end: endDate,
      };
    }
  }
  
  // Tentar usar current_period_start e current_period_end (campos padrão do Stripe)
  if (subscription.current_period_start && subscription.current_period_end) {
    return {
      start: stripeTimestampToDate(subscription.current_period_start),
      end: stripeTimestampToDate(subscription.current_period_end),
    };
  }
  
  // Fallback: usar start_date ou created e calcular o fim baseado no plano
  const startTimestamp = subscription.start_date || subscription.created || subscription.billing_cycle_anchor;
  const plan = subscription.plan || subscription.items?.data?.[0]?.plan;
  
  if (startTimestamp && plan) {
    const start = stripeTimestampToDate(startTimestamp);
    const end = calculatePeriodEnd(startTimestamp, plan.interval, plan.interval_count);
    return { start, end };
  }
  
  // Último fallback: só usar start_date se disponível
  if (startTimestamp) {
    return {
      start: stripeTimestampToDate(startTimestamp),
      end: null,
    };
  }
  
  return { start: null, end: null };
};

export default {
  // Criar sessão de checkout do Stripe
  async createCheckoutSession(req, res) {
    try {
      const userId = req.user.user_id;
      
      // Buscar dados do usuário
      const user = await db("users").where({ id: userId }).first();
      
      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }

      let customerId = user.stripe_customer_id;

      // Se o usuário não tem customer_id no Stripe, criar um
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.name,
          metadata: {
            user_id: userId.toString(),
          },
        });

        customerId = customer.id;
        
        // Salvar customer_id no banco
        await db("users")
          .where({ id: userId })
          .update({ stripe_customer_id: customerId });
      }

      // Verificar se o usuário já teve assinatura antes (para não dar trial novamente)
      const hasHadSubscription = !!user.subscription_id;
      
      // Criar sessão de checkout
      const sessionConfig = {
        customer: customerId,
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [
          {
            price: process.env.STRIPE_PRICE_ID, // ID do preço do produto no Stripe
            quantity: 1,
          },
        ],
        success_url: `https://connectsaude.netlify.app/settings`,
        cancel_url: `https://connectsaude.netlify.app/settings`,
        metadata: {
          user_id: userId.toString(),
        },
      };

      // Adicionar trial de 7 dias apenas se o usuário nunca teve assinatura
      if (!hasHadSubscription) {
        sessionConfig.subscription_data = {
          trial_period_days: 7, // 1 semana de teste grátis
        };
      }

      const session = await stripe.checkout.sessions.create(sessionConfig);

      return res.json({ url: session.url });
    } catch (error) {
      console.error("Erro ao criar sessão de checkout:", error);
      return res.status(500).json({ 
        error: "Erro ao criar sessão de checkout",
        details: error.message 
      });
    }
  },

  // Obter status da assinatura do usuário
  async getSubscriptionStatus(req, res) {
    try {
      const userId = req.user.user_id;

      const user = await db("users")
        .select(
          "stripe_customer_id",
          "subscription_id",
          "subscription_status",
          "subscription_start_date",
          "subscription_end_date"
        )
        .where({ id: userId })
        .first();

      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }

      // Se não tem customer_id, ainda não tem assinatura
      if (!user.stripe_customer_id) {
      return res.json({
        hasSubscription: false,
        status: "inactive",
        subscriptionId: null,
        startDate: null,
        endDate: null,
        isTrialing: false,
        hasAccess: false,
      });
      }

      let cancelAtPeriodEnd = false;
      let subscription = null;
      
      // Se tem subscription_id, buscar dados atualizados do Stripe
      if (user.subscription_id) {
        try {
          subscription = await stripe.subscriptions.retrieve(
            user.subscription_id
          );

          // Armazenar cancel_at_period_end para retornar
          cancelAtPeriodEnd = subscription.cancel_at_period_end || false;

          // Verificar se está em trial (status 'trialing' do Stripe)
          const isTrialing = subscription.status === "trialing";
          
          // Calcular datas corretas do período
          const { start: startDate, end: endDate } = getSubscriptionPeriodDates(subscription);

          // Se está em trial ou se o status mudou, atualizar no banco
          // Durante trial, sempre recalcular para garantir que usa trial_end (7 dias) e não current_period_end (1 mês)
          if (isTrialing || subscription.status !== user.subscription_status) {
            await db("users")
              .where({ id: userId })
              .update({
                subscription_status: subscription.status,
                subscription_start_date: startDate,
                subscription_end_date: endDate,
              });

            user.subscription_status = subscription.status;
            user.subscription_start_date = startDate;
            user.subscription_end_date = endDate;
          } else if (subscription.status === user.subscription_status) {
            // Mesmo que status não mudou, usar datas do Stripe para garantir precisão
            user.subscription_start_date = startDate;
            user.subscription_end_date = endDate;
          }
        } catch (stripeError) {
          console.error("Erro ao buscar assinatura no Stripe:", stripeError);
          // Continuar com dados do banco se houver erro
        }
      }

      // Verificar se está em trial (status 'trialing' do Stripe)
      // Ou se foi cancelada mas tinha trial (verificar por trial_end no Stripe)
      const isTrialing = user.subscription_status === "trialing" || 
                         (subscription && subscription.status === "trialing") ||
                         (subscription && subscription.status === "canceled" && subscription.trial_end);

      // Determinar data de expiração correta
      // Se está canceled mas tinha trial, verificar se ainda está dentro do período do trial
      let endDate = user.subscription_end_date;
      if (subscription && subscription.status === "canceled" && subscription.trial_end) {
        // Se cancelada após trial, usar trial_end para verificar acesso
        endDate = stripeTimestampToDate(subscription.trial_end);
      }

      // Verificar se tem acesso (ativa ou trialing)
      // Se está canceled, SEMPRE sem acesso, não verificar data
      let hasAccess = false;
      if (user.subscription_status === "active" || user.subscription_status === "trialing") {
        hasAccess = true;
      } else if (user.subscription_status === "canceled") {
        // Se cancelada, SEMPRE sem acesso (não verificar data)
        hasAccess = false;
      } else {
        // Qualquer outro status (inactive, past_due, etc) = sem acesso
        hasAccess = false;
      }

      return res.json({
        hasSubscription: !!user.subscription_id,
        status: user.subscription_status || "inactive",
        subscriptionId: user.subscription_id,
        startDate: user.subscription_start_date,
        endDate: endDate || user.subscription_end_date,
        cancelAtPeriodEnd: cancelAtPeriodEnd,
        isTrialing: isTrialing,
        hasAccess: hasAccess,
      });
    } catch (error) {
      console.error("Erro ao obter status da assinatura:", error);
      return res.status(500).json({ 
        error: "Erro ao obter status da assinatura",
        details: error.message 
      });
    }
  },

  // Webhook do Stripe - focado apenas em pagamentos (sucesso ou falha)
  async handleWebhook(req, res) {
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      console.error("Erro ao verificar webhook:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;
          
          // Só processar se for assinatura
          if (session.mode === "subscription") {
            const subscriptionId = session.subscription;
            const userId = parseInt(session.metadata.user_id);

            if (!userId || isNaN(userId)) {
              console.error("User ID inválido no metadata:", session.metadata);
              break;
            }

            // Buscar dados da assinatura
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);

            console.log('subscription', subscription)
            
            // Obter datas de período da subscription
            const { start: startDate, end: endDate } = getSubscriptionPeriodDates(subscription);
            
            // Salvar assinatura no banco (pagamento inicial deu certo)
            await db("users")
              .where({ id: userId })
              .update({
                subscription_id: subscriptionId,
                subscription_status: subscription.status,
                subscription_start_date: startDate,
                subscription_end_date: endDate,
              });
          }
          break;
        }

        case "invoice.payment_succeeded": {
          const invoice = event.data.object;
          
          // Só processar se for fatura de assinatura
          if (invoice.subscription) {
            const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
            const user = await db("users")
              .where({ stripe_customer_id: subscription.customer })
              .first();

            if (user) {
              // Pagamento bem-sucedido (pode ser renovação ou pagamento inicial)
              const { start: startDate, end: endDate } = getSubscriptionPeriodDates(subscription);
              
              await db("users")
                .where({ id: user.id })
                .update({
                  subscription_status: subscription.status,
                  subscription_start_date: startDate,
                  subscription_end_date: endDate,
                });
            }
          }
          break;
        }

        case "invoice.payment_failed": {
          const invoice = event.data.object;
          
          // Só processar se for fatura de assinatura
          if (invoice.subscription) {
            const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
            const user = await db("users")
              .where({ stripe_customer_id: subscription.customer })
              .first();

            if (user) {
              // Pagamento falhou - atualizar status
              await db("users")
                .where({ id: user.id })
                .update({
                  subscription_status: subscription.status, // Geralmente 'past_due'
                });
            }
          }
          break;
        }

        case "customer.subscription.deleted": {
          const subscription = event.data.object;
          
          // Subscription foi cancelada definitivamente
          const user = await db("users")
            .where({ stripe_customer_id: subscription.customer })
            .first();

          if (user) {
            // Se tinha trial, usar trial_end (fim do teste de 7 dias)
            // Caso contrário, usar ended_at (fim do período pago)
            const endDate = subscription.trial_end 
              ? stripeTimestampToDate(subscription.trial_end)
              : stripeTimestampToDate(subscription.ended_at);
            
            await db("users")
              .where({ id: user.id })
              .update({
                subscription_status: "canceled",
                subscription_end_date: endDate,
              });
          }
          break;
        }

        case "customer.subscription.updated": {
          const subscription = event.data.object;
          
          // Atualizar status quando houver mudanças na subscription
          const user = await db("users")
            .where({ stripe_customer_id: subscription.customer })
            .first();

          if (user) {
            const { start: startDate, end: endDate } = getSubscriptionPeriodDates(subscription);
            
            await db("users")
              .where({ id: user.id })
              .update({
                subscription_status: subscription.status,
                subscription_start_date: startDate,
                subscription_end_date: endDate,
              });
          }
          break;
        }

        default:
          // Outros eventos são apenas logados
          console.log(`Evento não tratado: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error("Erro ao processar webhook:", error);
      res.status(500).json({ error: "Erro ao processar webhook" });
    }
  },

  // Cancelar assinatura
  async cancelSubscription(req, res) {
    try {
      const userId = req.user.user_id;

      const user = await db("users")
        .select("subscription_id", "subscription_status")
        .where({ id: userId })
        .first();

      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }

      if (!user.subscription_id) {
        return res.status(400).json({ error: "Usuário não possui assinatura ativa" });
      }

      // Buscar subscription atual do Stripe para verificar status
      const subscription = await stripe.subscriptions.retrieve(user.subscription_id);
      const isTrialing = subscription.status === "trialing" || user.subscription_status === "trialing";

      // Cancelar ao fim do período (trial ou período pago)
      // Durante o trial: usuário continua usando até os 7 dias
      // Após pagar: usuário continua usando até o fim do período pago
      const updatedSubscription = await stripe.subscriptions.update(user.subscription_id, {
        cancel_at_period_end: true,
      });

      const message = isTrialing 
        ? "Assinatura será cancelada ao final do período de teste. Você continuará tendo acesso até então."
        : "Assinatura será cancelada ao fim do período pago. Você continuará tendo acesso até então.";

      // Atualizar status no banco
      const { start: startDate, end: endDate } = getSubscriptionPeriodDates(updatedSubscription);

      await db("users")
        .where({ id: userId })
        .update({
          subscription_status: updatedSubscription.status,
          subscription_start_date: startDate,
          subscription_end_date: endDate,
        });

      return res.json({
        success: true,
        message: message,
        status: updatedSubscription.status,
        cancelAtPeriodEnd: updatedSubscription.cancel_at_period_end,
        endDate: endDate,
        isTrialing: isTrialing,
      });
    } catch (error) {
      console.error("Erro ao cancelar assinatura:", error);
      return res.status(500).json({
        error: "Erro ao cancelar assinatura",
        details: error.message,
      });
    }
  },

  // Reativar assinatura
  async reactivateSubscription(req, res) {
    try {
      const userId = req.user.user_id;

      const user = await db("users")
        .select("subscription_id")
        .where({ id: userId })
        .first();

      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }

      if (!user.subscription_id) {
        return res.status(400).json({ error: "Usuário não possui assinatura" });
      }

      // Buscar subscription atual
      let subscription = await stripe.subscriptions.retrieve(user.subscription_id);

      // Verificar se está cancelada ou agendada para cancelamento
      if (subscription.status === "canceled") {
        return res.status(400).json({
          error: "Não é possível reativar uma assinatura já cancelada. Crie uma nova assinatura.",
        });
      }

      // Se está agendada para cancelamento, remover o cancelamento
      if (subscription.cancel_at_period_end) {
        subscription = await stripe.subscriptions.update(user.subscription_id, {
          cancel_at_period_end: false,
        });
      }

      // Atualizar status no banco
      const { start: startDate, end: endDate } = getSubscriptionPeriodDates(subscription);

      await db("users")
        .where({ id: userId })
        .update({
          subscription_status: subscription.status,
          subscription_start_date: startDate,
          subscription_end_date: endDate,
        });

      return res.json({
        success: true,
        message: "Assinatura reativada com sucesso",
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        startDate: startDate,
        endDate: endDate,
      });
    } catch (error) {
      console.error("Erro ao reativar assinatura:", error);
      return res.status(500).json({
        error: "Erro ao reativar assinatura",
        details: error.message,
      });
    }
  },
};
