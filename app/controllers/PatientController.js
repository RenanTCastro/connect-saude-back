import db from "../database/index.js";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

dayjs.extend(utc);
dayjs.extend(timezone);

export default {
  async createPatient(req, res) {
    try {
      const userId = req.user.user_id;
      const {
        full_name,
        gender,
        phone,
        street,
        neighborhood,
        city,
        state,
        zip_code,
        birth_date,
        cpf,
      } = req.body;

      if (!full_name || !cpf) {
        return res.status(400).json({
          error: "Os campos 'full_name' e 'cpf' são obrigatórios.",
        });
      }

      // Verificar se já existe um paciente com o mesmo CPF para este usuário
      const existingPatient = await db("patients")
        .where({ user_id: userId, cpf: cpf })
        .first();

      if (existingPatient) {
        return res.status(400).json({
          error: "Já existe um paciente cadastrado com este CPF na sua conta.",
        });
      }

      const lastPatient = await db("patients")
        .where({ user_id: userId })
        .max("patient_number as last_number")
        .first();

      const nextPatientNumber = (lastPatient?.last_number || 0) + 1;

      await db("patients")
        .insert({
          user_id: userId,
          patient_number: nextPatientNumber,
          full_name,
          gender,
          phone,
          street,
          neighborhood,
          city,
          state,
          zip_code,
          birth_date,
          cpf,
          created_at: db.fn.now(),
          updated_at: db.fn.now(),
        })

      return res.status(201).json({message: "Paciente criado com sucesso!"});
    } catch (error) {
      console.error("Erro ao criar paciente:", error);
      return res.status(500).json({
        error: "Erro ao criar paciente.",
        details: error.message,
      });
    }
  },

  async getPatients(req, res) {
    try {
      const userId = req.user.user_id;
      const { search } = req.query;

      let query = db("patients")
        .where({ user_id: userId })
        .orderBy("patient_number", "asc");

      if (search) {
        query = query.andWhere((builder) => {
          builder
            .whereILike("full_name", `%${search}%`)
            .orWhereILike("cpf", `%${search}%`);
        });
      }

      const patients = await query;

      const now = dayjs().tz("America/Sao_Paulo");

      const patientsWithAge = patients.map((p) => {
        let age = null;

        if (p.birth_date) {
          const birthDate = dayjs(p.birth_date).tz("America/Sao_Paulo");
          age = now.diff(birthDate, "year");
        }

        return { ...p, age };
      });

      return res.status(200).json(patientsWithAge);
    } catch (error) {
      console.error("Erro ao buscar pacientes:", error);
      return res.status(500).json({
        error: "Erro ao buscar pacientes.",
        details: error.message,
      });
    }
  },

  async getPatientById(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.user_id;

      const patient = await db("patients")
        .where({ id, user_id: userId })
        .first();

      if (!patient) {
        return res.status(404).json({ error: "Paciente não encontrado." });
      }

      const now = dayjs().tz("America/Sao_Paulo");
      let age = null;
      if (patient.birth_date) {
        const birthDate = dayjs(patient.birth_date).tz("America/Sao_Paulo");
        age = now.diff(birthDate, "year");
      }

      return res.status(200).json({
        ...patient,
        age,
      });
    } catch (error) {
      console.error("Erro ao buscar paciente:", error);
      return res.status(500).json({
        error: "Erro ao buscar paciente.",
        details: error.message,
      });
    }
  },

  async updatePatient(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.user_id;
      const {
        full_name,
        gender,
        phone,
        street,
        neighborhood,
        city,
        state,
        zip_code,
        birth_date,
        cpf,
      } = req.body;

      // Verificar se já existe outro paciente com o mesmo CPF para este usuário
      if (cpf) {
        const existingPatient = await db("patients")
          .where({ user_id: userId, cpf: cpf })
          .whereNot({ id: id })
          .first();

        if (existingPatient) {
          return res.status(400).json({
            error: "Já existe outro paciente cadastrado com este CPF na sua conta.",
          });
        }
      }

      await db("patients")
        .where({ id, user_id: userId })
        .update(
          {
            full_name,
            gender,
            phone,
            street,
            neighborhood,
            city,
            state,
            zip_code,
            birth_date,
            cpf,
            updated_at: db.fn.now(),
          },
        );

      return res.status(200).json({message: "Paciente atualizado com sucesso!"});
    } catch (error) {
      console.error("Erro ao atualizar paciente:", error);
      return res.status(500).json({
        error: "Erro ao atualizar paciente.",
        details: error.message,
      });
    }
  },

  async deletePatient(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.user_id;

      const patient = await db("patients")
        .where({ id, user_id: userId })
        .first();

      if (!patient) {
        return res.status(404).json({
          error: "Paciente não encontrado ou sem permissão para excluir.",
        });
      }

      await db("patients")
        .where({ id, user_id: userId })
        .del();

      return res.status(200).json({ message: "Paciente excluído com sucesso!" });
    } catch (error) {
      console.error("Erro ao excluir paciente:", error);
      return res.status(500).json({
        error: "Erro ao excluir paciente.",
        details: error.message,
      });
    }
  },

  async getPatientInvoices(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.user_id;

      // Verificar se o paciente existe e pertence ao usuário
      const patient = await db("patients")
        .where({ id, user_id: userId })
        .first();

      if (!patient) {
        return res.status(404).json({ error: "Paciente não encontrado." });
      }

      // Buscar parcelas do paciente
      const installments = await db("installments")
        .join("transactions", "installments.transaction_id", "transactions.id")
        .where("transactions.user_id", userId)
        .where("transactions.patient_id", id)
        .where("transactions.type", "income")
        .select(
          "installments.id",
          "installments.due_date as dueDate",
          "installments.payment_date as paymentDate",
          "transactions.title",
          "transactions.description",
          "installments.amount",
          "installments.is_paid",
          "installments.installment_number",
          "transactions.payment_type as paymentType",
          "transactions.id as transactionId"
        )
        .orderBy("installments.due_date", "desc");

      // Buscar transações simples (sem parcelas) do paciente
      const simpleTransactions = await db("transactions")
        .where("user_id", userId)
        .where("patient_id", id)
        .where("type", "income")
        .whereNotExists(function() {
          this.select("*")
            .from("installments")
            .whereRaw("installments.transaction_id = transactions.id");
        })
        .select(
          "id",
          "due_date as dueDate",
          "payment_date as paymentDate",
          "title",
          "description",
          "amount",
          "is_paid",
          "payment_type as paymentType",
          "id as transactionId"
        )
        .orderBy("due_date", "desc");

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
        paymentDate: inst.paymentDate,
        title: inst.title,
        description: inst.description,
        amount: parseFloat(inst.amount) || 0,
        isPaid: inst.is_paid,
        paymentType: inst.paymentType,
        installment: {
          current: inst.installment_number,
          total: totalInstallmentsMap[inst.transactionId] || 1,
        },
        transactionId: inst.transactionId,
        type: "installment",
      }));

      // Formatar transações simples
      const formattedSimpleTransactions = simpleTransactions.map((trans) => ({
        id: `transaction_${trans.id}`,
        dueDate: trans.dueDate,
        paymentDate: trans.paymentDate,
        title: trans.title,
        description: trans.description,
        amount: parseFloat(trans.amount) || 0,
        isPaid: trans.is_paid,
        paymentType: trans.paymentType,
        installment: {
          current: 1,
          total: 1,
        },
        transactionId: trans.transactionId,
        type: "transaction",
      }));

      // Combinar e ordenar por data (mais recente primeiro)
      const allInvoices = [...formattedInstallments, ...formattedSimpleTransactions]
        .sort((a, b) => {
          const dateA = new Date(a.dueDate);
          const dateB = new Date(b.dueDate);
          return dateB - dateA; // Descendente
        });

      return res.status(200).json(allInvoices);
    } catch (error) {
      console.error("Erro ao buscar faturas do paciente:", error);
      return res.status(500).json({
        error: "Erro ao buscar faturas do paciente.",
        details: error.message,
      });
    }
  }
};
