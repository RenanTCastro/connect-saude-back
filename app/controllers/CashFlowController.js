import db from "../database/index.js";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

dayjs.extend(utc);
dayjs.extend(timezone);

export default {
  async getPeriodData(req, res) {
    try {
      const userId = req.user.user_id;
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          error: "As datas início e fim são obrigatórias.",
        });
      }

      // Buscar receitas (type = 'income')
      const incomesData = await db("transactions")
        .leftJoin("patients", "transactions.patient_id", "patients.id")
        .where("transactions.user_id", userId)
        .where("transactions.type", "income")
        .whereBetween("transactions.due_date", [startDate, endDate])
        .select(
          "transactions.id",
          "transactions.due_date as dueDate",
          "transactions.title",
          "transactions.description",
          "transactions.patient_id as patientId",
          "patients.full_name as patientName",
          "transactions.payment_type as paymentType",
          "transactions.amount",
          "transactions.is_paid as isPaid",
          "transactions.payment_date as paymentDate"
        )
        .orderBy("transactions.due_date", "asc");

      // Buscar despesas (type = 'expense')
      const expensesData = await db("transactions")
        .where("user_id", userId)
        .where("type", "expense")
        .whereBetween("due_date", [startDate, endDate])
        .select(
          "id",
          "due_date as dueDate",
          "title",
          "description",
          "payment_type as paymentType",
          "amount",
          "recurrence",
          "is_paid as isPaid",
          "payment_date as paymentDate"
        )
        .orderBy("due_date", "asc");

      // Garantir que amounts sejam números e isPaid seja booleano
      const incomes = incomesData.map(item => ({
        ...item,
        amount: parseFloat(item.amount) || 0,
        isPaid: Boolean(item.isPaid),
      }));

      const expenses = expensesData.map(item => ({
        ...item,
        amount: parseFloat(item.amount) || 0,
        isPaid: Boolean(item.isPaid),
      }));

      return res.status(200).json({
        incomes,
        expenses,
      });
    } catch (error) {
      console.error("Erro ao buscar dados do período:", error);
      return res.status(500).json({
        error: "Erro ao buscar dados do período.",
        details: error.message,
      });
    }
  },

  async createIncome(req, res) {
    try {
      const userId = req.user.user_id;
      const {
        title,
        description,
        amount,
        dueDate,
        patientId,
        paymentType,
        installments,
      } = req.body;

      // Validações
      if (!title || !amount || !dueDate || !paymentType) {
        return res.status(400).json({
          error: "Os campos título, valor, data de vencimento e tipo de pagamento são obrigatórios.",
        });
      }

      if (amount <= 0) {
        return res.status(400).json({
          error: "O valor deve ser maior que zero.",
        });
      }

      const validPaymentTypes = ["Dinheiro", "PIX", "Cartão", "Transferência"];
      if (!validPaymentTypes.includes(paymentType)) {
        return res.status(400).json({
          error: "Tipo de pagamento inválido.",
        });
      }

      // Verificar se paciente existe (se fornecido)
      if (patientId) {
        const patient = await db("patients")
          .where({ id: patientId, user_id: userId })
          .first();
        if (!patient) {
          return res.status(404).json({
            error: "Paciente não encontrado.",
          });
        }
      }

      // Se tiver parcelas
      if (installments && installments.count > 1) {
        const { count, firstDate, interval, intervalType } = installments;

        if (!count || !firstDate || !interval || !intervalType) {
          return res.status(400).json({
            error: "Para parcelamento, informe: count, firstDate, interval e intervalType.",
          });
        }

        const validIntervalTypes = ["daily", "weekly", "monthly"];
        if (!validIntervalTypes.includes(intervalType)) {
          return res.status(400).json({
            error: "intervalType deve ser: daily, weekly ou monthly.",
          });
        }

        // Criar transaction principal
        const [transaction] = await db("transactions")
          .insert({
            user_id: userId,
            patient_id: patientId || null,
            type: "income",
            title,
            description,
            amount: 0, // Valor total será calculado das parcelas
            due_date: firstDate,
            payment_type: paymentType,
            is_paid: false,
            created_at: db.fn.now(),
            updated_at: db.fn.now(),
          })
          .returning("id");

        // Calcular valor por parcela
        const installmentAmount = parseFloat((amount / count).toFixed(2));
        const remainder = parseFloat(amount) - installmentAmount * count;
        const firstAmount = installmentAmount + remainder;

        // Gerar parcelas
        const installmentsData = [];
        let currentDate = dayjs(firstDate);

        for (let i = 1; i <= count; i++) {
          let installmentDueDate = currentDate.format("YYYY-MM-DD");
          let installmentValue = i === 1 ? firstAmount : installmentAmount;

          installmentsData.push({
            transaction_id: transaction.id,
            installment_number: i,
            amount: installmentValue,
            due_date: installmentDueDate,
            is_paid: false,
            created_at: db.fn.now(),
          });

          // Calcular próxima data
          if (i < count) {
            if (intervalType === "daily") {
              currentDate = currentDate.add(interval, "day");
            } else if (intervalType === "weekly") {
              currentDate = currentDate.add(interval, "week");
            } else if (intervalType === "monthly") {
              currentDate = currentDate.add(interval, "month");
            }
          }
        }

        await db("installments").insert(installmentsData);

        return res.status(201).json({
          message: "Receita parcelada criada com sucesso!",
          transactionId: transaction.id,
        });
      } else {
        // Criar transaction única (sem parcelas)
        await db("transactions").insert({
          user_id: userId,
          patient_id: patientId || null,
          type: "income",
          title,
          description,
          amount,
          due_date: dueDate,
          payment_type: paymentType,
          is_paid: false,
          created_at: db.fn.now(),
          updated_at: db.fn.now(),
        });

        return res.status(201).json({
          message: "Receita criada com sucesso!",
        });
      }
    } catch (error) {
      console.error("Erro ao criar receita:", error);
      return res.status(500).json({
        error: "Erro ao criar receita.",
        details: error.message,
      });
    }
  },

  async createExpense(req, res) {
    try {
      const userId = req.user.user_id;
      const {
        title,
        description,
        amount,
        dueDate,
        paymentType,
        recurrence,
      } = req.body;

      // Validações
      if (!title || !amount || !dueDate || !paymentType) {
        return res.status(400).json({
          error: "Os campos título, valor, data de vencimento e tipo de pagamento são obrigatórios.",
        });
      }

      if (amount <= 0) {
        return res.status(400).json({
          error: "O valor deve ser maior que zero.",
        });
      }

      const validPaymentTypes = ["Dinheiro", "PIX", "Cartão", "Transferência"];
      if (!validPaymentTypes.includes(paymentType)) {
        return res.status(400).json({
          error: "Tipo de pagamento inválido.",
        });
      }

      let recurrenceJson = null;

      // Se for recorrente
      if (recurrence) {
        const { frequency, interval, endDate } = recurrence;

        if (!frequency || !interval) {
          return res.status(400).json({
            error: "Para recorrência, informe: frequency e interval.",
          });
        }

        const validFrequencies = ["daily", "weekly", "monthly", "yearly"];
        if (!validFrequencies.includes(frequency)) {
          return res.status(400).json({
            error: "frequency deve ser: daily, weekly, monthly ou yearly.",
          });
        }

        recurrenceJson = JSON.stringify({
          frequency,
          interval,
          endDate: endDate || null,
        });
      }

      // Criar transaction
      await db("transactions").insert({
        user_id: userId,
        type: "expense",
        title,
        description,
        amount,
        due_date: dueDate,
        payment_type: paymentType,
        recurrence: recurrenceJson,
        is_paid: false,
        created_at: db.fn.now(),
        updated_at: db.fn.now(),
      });

      return res.status(201).json({
        message: "Despesa criada com sucesso!",
      });
    } catch (error) {
      console.error("Erro ao criar despesa:", error);
      return res.status(500).json({
        error: "Erro ao criar despesa.",
        details: error.message,
      });
    }
  },

  async getReceivables(req, res) {
    try {
      const userId = req.user.user_id;

      // Buscar parcelas pendentes
      const installments = await db("installments")
        .join("transactions", "installments.transaction_id", "transactions.id")
        .leftJoin("patients", "transactions.patient_id", "patients.id")
        .where("transactions.user_id", userId)
        .where("transactions.type", "income")
        .where("installments.is_paid", false)
        .select(
          "installments.id",
          "installments.due_date as dueDate",
          "transactions.title",
          "patients.full_name as patientName",
          "installments.amount",
          "installments.installment_number",
          "transactions.id as transactionId"
        )
        .orderBy("installments.due_date", "asc");

      // Buscar receitas simples não pagas (sem parcelas)
      const simpleIncomes = await db("transactions")
        .leftJoin("patients", "transactions.patient_id", "patients.id")
        .where("transactions.user_id", userId)
        .where("transactions.type", "income")
        .where("transactions.is_paid", false)
        .whereNotExists(function() {
          this.select("*")
            .from("installments")
            .whereRaw("installments.transaction_id = transactions.id");
        })
        .select(
          "transactions.id",
          "transactions.due_date as dueDate",
          "transactions.title",
          "patients.full_name as patientName",
          "transactions.amount",
          "transactions.id as transactionId"
        )
        .orderBy("transactions.due_date", "asc");

      // Buscar total de parcelas por transaction para calcular current/total
      const transactionIds = [...new Set(installments.map((i) => i.transactionId))];
      const totalInstallmentsMap = {};

      for (const transactionId of transactionIds) {
        const total = await db("installments")
          .where("transaction_id", transactionId)
          .count("* as total")
          .first();
        totalInstallmentsMap[transactionId] = parseInt(total.total);
      }

      // Formatar parcelas
      const formattedInstallments = installments.map((inst) => ({
        id: inst.id,
        dueDate: inst.dueDate,
        title: inst.title,
        patientName: inst.patientName,
        amount: parseFloat(inst.amount),
        installment: {
          current: inst.installment_number,
          total: totalInstallmentsMap[inst.transactionId] || 1,
        },
      }));

      // Formatar receitas simples
      const formattedSimpleIncomes = simpleIncomes.map((income) => ({
        id: `transaction_${income.id}`, // Prefixo para não conflitar com IDs de parcelas
        dueDate: income.dueDate,
        title: income.title,
        patientName: income.patientName,
        amount: parseFloat(income.amount) || 0,
        installment: {
          current: 1,
          total: 1,
        },
        transactionId: income.transactionId,
      }));

      // Combinar e ordenar por data
      const allReceivables = [...formattedInstallments, ...formattedSimpleIncomes]
        .sort((a, b) => {
          const dateA = new Date(a.dueDate);
          const dateB = new Date(b.dueDate);
          return dateA - dateB;
        });

      return res.status(200).json(allReceivables);
    } catch (error) {
      console.error("Erro ao buscar saldo a receber:", error);
      return res.status(500).json({
        error: "Erro ao buscar saldo a receber.",
        details: error.message,
      });
    }
  },

  async markInstallmentAsPaid(req, res) {
    try {
      const userId = req.user.user_id;
      const { id } = req.params;

      // Verificar se é uma receita simples (formato: transaction_123) ou parcela
      if (id.startsWith("transaction_")) {
        // É uma receita simples
        const transactionId = id.replace("transaction_", "");
        
        // Verificar se a transaction existe e pertence ao usuário
        const transaction = await db("transactions")
          .where("id", transactionId)
          .where("user_id", userId)
          .where("type", "income")
          .first();

        if (!transaction) {
          return res.status(404).json({
            error: "Receita não encontrada ou sem permissão.",
          });
        }

        // Verificar se não tem parcelas
        const hasInstallments = await db("installments")
          .where("transaction_id", transactionId)
          .first();

        if (hasInstallments) {
          return res.status(400).json({
            error: "Esta receita possui parcelas. Use o endpoint de parcelas.",
          });
        }

        // Marcar transaction como paga
        const now = dayjs().format("YYYY-MM-DD");
        await db("transactions")
          .where("id", transactionId)
          .update({
            is_paid: true,
            payment_date: now,
          });

        return res.status(200).json({
          message: "Receita marcada como paga com sucesso!",
        });
      } else {
        // É uma parcela
        // Verificar se a parcela existe e pertence ao usuário
        const installment = await db("installments")
          .join("transactions", "installments.transaction_id", "transactions.id")
          .where("installments.id", id)
          .where("transactions.user_id", userId)
          .select("installments.*")
          .first();

        if (!installment) {
          return res.status(404).json({
            error: "Parcela não encontrada ou sem permissão.",
          });
        }

        // Marcar como paga
        const now = dayjs().format("YYYY-MM-DD");
        await db("installments")
          .where("id", id)
          .update({
            is_paid: true,
            payment_date: now,
          });

        // Verificar se todas as parcelas da transação foram pagas
        const unpaidCount = await db("installments")
          .where("transaction_id", installment.transaction_id)
          .where("is_paid", false)
          .count("* as count")
          .first();

        if (parseInt(unpaidCount.count) === 0) {
          // Marcar transaction como paga também
          await db("transactions")
            .where("id", installment.transaction_id)
            .update({
              is_paid: true,
              payment_date: now,
            });
        }

        return res.status(200).json({
          message: "Parcela marcada como paga com sucesso!",
        });
      }
    } catch (error) {
      console.error("Erro ao marcar como paga:", error);
      return res.status(500).json({
        error: "Erro ao marcar como paga.",
        details: error.message,
      });
    }
  },

  async updateIncome(req, res) {
    try {
      const userId = req.user.user_id;
      const { id } = req.params;
      const {
        title,
        description,
        amount,
        dueDate,
        patientId,
        paymentType,
      } = req.body;

      // Verificar se a transaction existe e pertence ao usuário
      const transaction = await db("transactions")
        .where("id", id)
        .where("user_id", userId)
        .where("type", "income")
        .first();

      if (!transaction) {
        return res.status(404).json({
          error: "Receita não encontrada ou sem permissão.",
        });
      }

      // Verificar se tem parcelas (não permitir edição de receitas parceladas por este endpoint)
      const hasInstallments = await db("installments")
        .where("transaction_id", id)
        .first();

      if (hasInstallments) {
        return res.status(400).json({
          error: "Receitas parceladas não podem ser editadas por este endpoint.",
        });
      }

      // Validações
      if (!title || !amount || !dueDate || !paymentType) {
        return res.status(400).json({
          error: "Os campos título, valor, data de vencimento e tipo de pagamento são obrigatórios.",
        });
      }

      if (amount <= 0) {
        return res.status(400).json({
          error: "O valor deve ser maior que zero.",
        });
      }

      const validPaymentTypes = ["Dinheiro", "PIX", "Cartão", "Transferência"];
      if (!validPaymentTypes.includes(paymentType)) {
        return res.status(400).json({
          error: "Tipo de pagamento inválido.",
        });
      }

      // Verificar se paciente existe (se fornecido)
      if (patientId) {
        const patient = await db("patients")
          .where({ id: patientId, user_id: userId })
          .first();
        if (!patient) {
          return res.status(404).json({
            error: "Paciente não encontrado.",
          });
        }
      }

      // Atualizar transaction
      await db("transactions")
        .where("id", id)
        .update({
          title,
          description: description || null,
          amount,
          due_date: dueDate,
          patient_id: patientId || null,
          payment_type: paymentType,
          updated_at: db.fn.now(),
        });

      return res.status(200).json({
        message: "Receita atualizada com sucesso!",
      });
    } catch (error) {
      console.error("Erro ao atualizar receita:", error);
      return res.status(500).json({
        error: "Erro ao atualizar receita.",
        details: error.message,
      });
    }
  },

  async deleteIncome(req, res) {
    try {
      const userId = req.user.user_id;
      const { id } = req.params;

      // Verificar se a transaction existe e pertence ao usuário
      const transaction = await db("transactions")
        .where("id", id)
        .where("user_id", userId)
        .where("type", "income")
        .first();

      if (!transaction) {
        return res.status(404).json({
          error: "Receita não encontrada ou sem permissão.",
        });
      }

      // Verificar se tem parcelas
      const hasInstallments = await db("installments")
        .where("transaction_id", id)
        .first();

      if (hasInstallments) {
        // Deletar parcelas primeiro
        await db("installments")
          .where("transaction_id", id)
          .delete();
      }

      // Deletar transaction
      await db("transactions")
        .where("id", id)
        .delete();

      return res.status(200).json({
        message: "Receita deletada com sucesso!",
      });
    } catch (error) {
      console.error("Erro ao deletar receita:", error);
      return res.status(500).json({
        error: "Erro ao deletar receita.",
        details: error.message,
      });
    }
  },

  async updateExpense(req, res) {
    try {
      const userId = req.user.user_id;
      const { id } = req.params;
      const {
        title,
        description,
        amount,
        dueDate,
        paymentType,
        recurrence,
      } = req.body;

      // Verificar se a transaction existe e pertence ao usuário
      const transaction = await db("transactions")
        .where("id", id)
        .where("user_id", userId)
        .where("type", "expense")
        .first();

      if (!transaction) {
        return res.status(404).json({
          error: "Despesa não encontrada ou sem permissão.",
        });
      }

      // Validações
      if (!title || !amount || !dueDate || !paymentType) {
        return res.status(400).json({
          error: "Os campos título, valor, data de vencimento e tipo de pagamento são obrigatórios.",
        });
      }

      if (amount <= 0) {
        return res.status(400).json({
          error: "O valor deve ser maior que zero.",
        });
      }

      const validPaymentTypes = ["Dinheiro", "PIX", "Cartão", "Transferência"];
      if (!validPaymentTypes.includes(paymentType)) {
        return res.status(400).json({
          error: "Tipo de pagamento inválido.",
        });
      }

      let recurrenceJson = null;

      // Se for recorrente
      if (recurrence) {
        const { frequency, interval, endDate } = recurrence;

        if (!frequency || !interval) {
          return res.status(400).json({
            error: "Para recorrência, informe: frequency e interval.",
          });
        }

        const validFrequencies = ["daily", "weekly", "monthly", "yearly"];
        if (!validFrequencies.includes(frequency)) {
          return res.status(400).json({
            error: "frequency deve ser: daily, weekly, monthly ou yearly.",
          });
        }

        recurrenceJson = JSON.stringify({
          frequency,
          interval,
          endDate: endDate || null,
        });
      }

      // Atualizar transaction
      await db("transactions")
        .where("id", id)
        .update({
          title,
          description: description || null,
          amount,
          due_date: dueDate,
          payment_type: paymentType,
          recurrence: recurrenceJson,
          updated_at: db.fn.now(),
        });

      return res.status(200).json({
        message: "Despesa atualizada com sucesso!",
      });
    } catch (error) {
      console.error("Erro ao atualizar despesa:", error);
      return res.status(500).json({
        error: "Erro ao atualizar despesa.",
        details: error.message,
      });
    }
  },

  async deleteExpense(req, res) {
    try {
      const userId = req.user.user_id;
      const { id } = req.params;

      // Verificar se a transaction existe e pertence ao usuário
      const transaction = await db("transactions")
        .where("id", id)
        .where("user_id", userId)
        .where("type", "expense")
        .first();

      if (!transaction) {
        return res.status(404).json({
          error: "Despesa não encontrada ou sem permissão.",
        });
      }

      // Deletar transaction
      await db("transactions")
        .where("id", id)
        .delete();

      return res.status(200).json({
        message: "Despesa deletada com sucesso!",
      });
    } catch (error) {
      console.error("Erro ao deletar despesa:", error);
      return res.status(500).json({
        error: "Erro ao deletar despesa.",
        details: error.message,
      });
    }
  },

  async togglePaidStatus(req, res) {
    try {
      const userId = req.user.user_id;
      const { id } = req.params;
      const { type } = req.query; // 'income' ou 'expense'

      if (!type || !['income', 'expense'].includes(type)) {
        return res.status(400).json({
          error: "Tipo deve ser 'income' ou 'expense'.",
        });
      }

      // Verificar se a transaction existe e pertence ao usuário
      const transaction = await db("transactions")
        .where("id", id)
        .where("user_id", userId)
        .where("type", type)
        .first();

      if (!transaction) {
        return res.status(404).json({
          error: "Transação não encontrada ou sem permissão.",
        });
      }

      // Verificar se tem parcelas (não permitir alterar status de receitas parceladas por este endpoint)
      const hasInstallments = await db("installments")
        .where("transaction_id", id)
        .first();

      if (hasInstallments) {
        return res.status(400).json({
          error: "Receitas parceladas não podem ter status alterado por este endpoint.",
        });
      }

      // Toggle do status
      const newStatus = !transaction.is_paid;
      const now = dayjs().format("YYYY-MM-DD");

      await db("transactions")
        .where("id", id)
        .update({
          is_paid: newStatus,
          payment_date: newStatus ? now : null,
          updated_at: db.fn.now(),
        });

      return res.status(200).json({
        message: newStatus ? "Marcado como pago!" : "Marcado como não pago!",
        isPaid: newStatus,
      });
    } catch (error) {
      console.error("Erro ao alterar status de pagamento:", error);
      return res.status(500).json({
        error: "Erro ao alterar status de pagamento.",
        details: error.message,
      });
    }
  },
};

