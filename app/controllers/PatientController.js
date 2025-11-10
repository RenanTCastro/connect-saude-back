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

      const lastPatient = await db("patients")
        .where({ user_id: userId })
        .max("patient_number as last_number")
        .first();

      const nextPatientNumber = (lastPatient?.last_number || 0) + 1;

      const [newPatient] = await db("patients")
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

      return res.status(201).json({
        message: "Paciente criado com sucesso!",
        patient: newPatient,
      });
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
  }
};
