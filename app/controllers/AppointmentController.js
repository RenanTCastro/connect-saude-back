import db from "../database/index.js";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

dayjs.extend(utc);
dayjs.extend(timezone);

async function createOrUpdateReminders(appointmentId, startDatetime, sendReminder) {
  if (!sendReminder || !startDatetime) {
    await db("appointment_reminders")
      .where("appointment_id", appointmentId)
      .delete();
    return;
  }

  const appointmentStart = dayjs(startDatetime).tz("America/Sao_Paulo");
  const now = dayjs().tz("America/Sao_Paulo");
  const hoursUntilAppointment = appointmentStart.diff(now, "hour", true);
  const minutesUntilAppointment = appointmentStart.diff(now, "minute", true);

  const reminder24hAt = appointmentStart.subtract(24, "hour");
  const reminder2hAt = appointmentStart.subtract(2, "hour");
  const reminder20minAt = now.add(20, "minute");

  await db("appointment_reminders")
    .where("appointment_id", appointmentId)
    .whereIn("status", ["pending"])
    .delete();

  if (hoursUntilAppointment < 2) {
    if (minutesUntilAppointment >= 30) {
      await db("appointment_reminders").insert({
        appointment_id: appointmentId,
        send_at: reminder20minAt.toISOString(),
        status: "pending",
        sent_count: 0,
        template_type: "twilioContentSid2h",
        created_at: db.fn.now(),
      });
    }
    return;
  }

  if (hoursUntilAppointment >= 12) {
    await db("appointment_reminders").insert({
      appointment_id: appointmentId,
      send_at: reminder24hAt.toISOString(),
      status: "pending",
      sent_count: 0,
      template_type: "twilioContentSid24h",
      created_at: db.fn.now(),
    });
  }

  await db("appointment_reminders").insert({
    appointment_id: appointmentId,
    send_at: reminder2hAt.toISOString(),
    status: "pending",
    sent_count: 0,
    template_type: "twilioContentSid2h",
    created_at: db.fn.now(),
  });
}

export default {
  async createAppointment(req, res) {
    try {
      const userId = req.user.user_id;
      const {
        type,
        patient_id,
        title,
        description,
        start_datetime,
        end_datetime,
        duration_minutes,
        notes,
        observation,
        follow_up_days,
        follow_up_date,
        send_confirmation,
        send_reminder,
        all_day,
        recurring,
        recurrence_id,
        label_id,
      } = req.body;

      // Validação baseada no tipo
      if (type === "consulta") {
        if (!patient_id) {
          return res.status(400).json({
            error: "O campo 'patient_id' é obrigatório para consultas.",
          });
        }
        if (!duration_minutes && !end_datetime) {
          return res.status(400).json({
            error: "É necessário informar 'duration_minutes' ou 'end_datetime' para consultas.",
          });
        }
      } else if (type === "compromisso") {
        if (!title) {
          return res.status(400).json({
            error: "O campo 'title' é obrigatório para compromissos.",
          });
        }
        if (!start_datetime || !end_datetime) {
          return res.status(400).json({
            error: "Os campos 'start_datetime' e 'end_datetime' são obrigatórios para compromissos.",
          });
        }
      } else {
        return res.status(400).json({
          error: "O campo 'type' deve ser 'consulta' ou 'compromisso'.",
        });
      }

      // Calcular end_datetime se duration_minutes fornecido
      let finalEndDatetime = end_datetime;
      if (duration_minutes && start_datetime) {
        const start = dayjs(start_datetime).tz("America/Sao_Paulo");
        finalEndDatetime = start.add(duration_minutes, "minute").toISOString();
      }

      // Validar que end_datetime > start_datetime
      if (finalEndDatetime && start_datetime) {
        const start = dayjs(start_datetime).tz("America/Sao_Paulo");
        const end = dayjs(finalEndDatetime).tz("America/Sao_Paulo");
        if (end.isBefore(start) || end.isSame(start)) {
          return res.status(400).json({
            error: "A data/hora de término deve ser posterior à data/hora de início.",
          });
        }
      }

      // Get patient name for title if it's a consulta
      let finalTitle = title;
      if (type === "consulta" && patient_id) {
        if (!finalTitle) {
          const patient = await db("patients").where({ id: patient_id }).first();
          finalTitle = patient ? patient.full_name : "Paciente não informado";
        }
      }

      // Preparar dados para inserção
      const appointmentData = {
        user_id: userId,
        type,
        patient_id: type === "consulta" ? patient_id : null,
        title: finalTitle || title || "Consulta",
        description: description || null,
        start_datetime: dayjs(start_datetime).tz("America/Sao_Paulo").toISOString(),
        end_datetime: finalEndDatetime ? dayjs(finalEndDatetime).tz("America/Sao_Paulo").toISOString() : null,
        duration_minutes: duration_minutes || null,
        observation: notes || observation || null,
        follow_up_date: follow_up_date || (follow_up_days
          ? dayjs(start_datetime).add(follow_up_days, "day").format("YYYY-MM-DD")
          : null),
        send_reminder: send_confirmation || send_reminder || false,
        label_id: label_id || null,
        status: "scheduled",
        created_at: db.fn.now(),
        updated_at: db.fn.now(),
      };

      // Adicionar campos específicos se existirem na migration
      if (recurrence_id) {
        appointmentData.recurrence_id = recurrence_id;
      }

      const result = await db("appointments")
        .insert(appointmentData)
        .returning("id");

      const insertedAppointment = Array.isArray(result) ? result[0] : result;
      const id = insertedAppointment?.id || insertedAppointment;

      // Criar lembretes se for consulta e send_reminder estiver ativado
      if (type === "consulta" && appointmentData.send_reminder) {
        await createOrUpdateReminders(
          id,
          appointmentData.start_datetime,
          appointmentData.send_reminder
        );
      }

      // Buscar o appointment criado com joins
      const appointment = await db("appointments")
        .select(
          "appointments.*",
          "patients.full_name as patient_full_name",
          "patients.cpf as patient_cpf",
          "labels.name as label_name",
          "labels.color as label_color"
        )
        .leftJoin("patients", "appointments.patient_id", "patients.id")
        .leftJoin("labels", "appointments.label_id", "labels.id")
        .where("appointments.id", id)
        .first();

      const formattedAppointment = {
        id: appointment.id,
        type: appointment.type,
        patient_id: appointment.patient_id,
        title: appointment.title,
        description: appointment.description,
        start_datetime: appointment.start_datetime,
        end_datetime: appointment.end_datetime,
        duration_minutes: appointment.duration_minutes,
        notes: appointment.observation,
        observation: appointment.observation,
        follow_up_date: appointment.follow_up_date,
        send_reminder: appointment.send_reminder,
        send_confirmation: appointment.send_reminder,
        label_id: appointment.label_id,
        status: appointment.status,
        recurrence_id: appointment.recurrence_id,
        created_at: appointment.created_at,
        updated_at: appointment.updated_at,
        patient: appointment.patient_id
          ? {
              id: appointment.patient_id,
              full_name: appointment.patient_full_name,
              cpf: appointment.patient_cpf,
            }
          : null,
        label: appointment.label_id
          ? {
              id: appointment.label_id,
              name: appointment.label_name,
              color: appointment.label_color,
            }
          : null,
      };

      return res.status(201).json(formattedAppointment);
    } catch (error) {
      console.error("Erro ao criar appointment:", error);
      return res.status(500).json({
        error: "Erro ao criar appointment.",
        details: error.message,
      });
    }
  },

  async getAppointments(req, res) {
    try {
      const userId = req.user.user_id;
      const { start_date, end_date, type, patient_id } = req.query;

      let query = db("appointments")
        .select(
          "appointments.*",
          "patients.full_name as patient_full_name",
          "patients.cpf as patient_cpf",
          "labels.name as label_name",
          "labels.color as label_color"
        )
        .leftJoin("patients", "appointments.patient_id", "patients.id")
        .leftJoin("labels", "appointments.label_id", "labels.id")
        .where("appointments.user_id", userId)
        .orderBy("appointments.start_datetime", "asc");

      if (start_date) {
        query = query.andWhere("appointments.start_datetime", ">=", start_date);
      }

      if (end_date) {
        query = query.andWhere("appointments.end_datetime", "<=", end_date);
      }

      if (type) {
        query = query.andWhere("appointments.type", type);
      }

      if (patient_id) {
        query = query.andWhere("appointments.patient_id", patient_id);
      }

      const appointments = await query;

      const formattedAppointments = appointments.map((appointment) => ({
        id: appointment.id,
        type: appointment.type,
        patient_id: appointment.patient_id,
        title: appointment.title,
        description: appointment.description,
        start_datetime: appointment.start_datetime,
        end_datetime: appointment.end_datetime,
        duration_minutes: appointment.duration_minutes,
        notes: appointment.observation,
        observation: appointment.observation,
        follow_up_date: appointment.follow_up_date,
        follow_up_days: appointment.follow_up_date ? null : null, // Será calculado se necessário
        send_reminder: appointment.send_reminder,
        send_confirmation: appointment.send_reminder,
        label_id: appointment.label_id,
        status: appointment.status,
        recurrence_id: appointment.recurrence_id,
        created_at: appointment.created_at,
        updated_at: appointment.updated_at,
        patient: appointment.patient_id
          ? {
              id: appointment.patient_id,
              full_name: appointment.patient_full_name,
              cpf: appointment.patient_cpf,
            }
          : null,
        label: appointment.label_id
          ? {
              id: appointment.label_id,
              name: appointment.label_name,
              color: appointment.label_color,
            }
          : null,
      }));

      return res.status(200).json(formattedAppointments);
    } catch (error) {
      console.error("Erro ao buscar appointments:", error);
      return res.status(500).json({
        error: "Erro ao buscar appointments.",
        details: error.message,
      });
    }
  },

  async getAppointmentById(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.user_id;

      const appointment = await db("appointments")
        .select(
          "appointments.*",
          "patients.full_name as patient_full_name",
          "patients.cpf as patient_cpf",
          "labels.name as label_name",
          "labels.color as label_color"
        )
        .leftJoin("patients", "appointments.patient_id", "patients.id")
        .leftJoin("labels", "appointments.label_id", "labels.id")
        .where("appointments.id", id)
        .where("appointments.user_id", userId)
        .first();

      if (!appointment) {
        return res.status(404).json({
          error: "Appointment não encontrado ou sem permissão.",
        });
      }

      const formattedAppointment = {
        id: appointment.id,
        type: appointment.type,
        patient_id: appointment.patient_id,
        title: appointment.title,
        description: appointment.description,
        start_datetime: appointment.start_datetime,
        end_datetime: appointment.end_datetime,
        duration_minutes: appointment.duration_minutes,
        notes: appointment.observation,
        observation: appointment.observation,
        follow_up_date: appointment.follow_up_date,
        send_reminder: appointment.send_reminder,
        send_confirmation: appointment.send_reminder,
        label_id: appointment.label_id,
        status: appointment.status,
        recurrence_id: appointment.recurrence_id,
        created_at: appointment.created_at,
        updated_at: appointment.updated_at,
        patient: appointment.patient_id
          ? {
              id: appointment.patient_id,
              full_name: appointment.patient_full_name,
              cpf: appointment.patient_cpf,
            }
          : null,
        label: appointment.label_id
          ? {
              id: appointment.label_id,
              name: appointment.label_name,
              color: appointment.label_color,
            }
          : null,
      };

      return res.status(200).json(formattedAppointment);
    } catch (error) {
      console.error("Erro ao buscar appointment:", error);
      return res.status(500).json({
        error: "Erro ao buscar appointment.",
        details: error.message,
      });
    }
  },

  async updateAppointment(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.user_id;
      const {
        type,
        patient_id,
        title,
        description,
        start_datetime,
        end_datetime,
        duration_minutes,
        notes,
        observation,
        follow_up_days,
        follow_up_date,
        send_confirmation,
        send_reminder,
        all_day,
        recurring,
        recurrence_id,
        label_id,
        status,
      } = req.body;

      // Verificar se o appointment existe e pertence ao usuário
      const existingAppointment = await db("appointments")
        .where({ id, user_id: userId })
        .first();

      if (!existingAppointment) {
        return res.status(404).json({
          error: "Appointment não encontrado ou sem permissão.",
        });
      }

      // Validação baseada no tipo
      const appointmentType = type || existingAppointment.type;
      if (appointmentType === "consulta") {
        if (patient_id === undefined && !existingAppointment.patient_id) {
          return res.status(400).json({
            error: "O campo 'patient_id' é obrigatório para consultas.",
          });
        }
      } else if (appointmentType === "compromisso") {
        if (!title && !existingAppointment.title) {
          return res.status(400).json({
            error: "O campo 'title' é obrigatório para compromissos.",
          });
        }
      }

      // Calcular end_datetime se duration_minutes fornecido
      let finalEndDatetime = end_datetime;
      const finalStartDatetime = start_datetime || existingAppointment.start_datetime;
      if (duration_minutes && finalStartDatetime) {
        const start = dayjs(finalStartDatetime).tz("America/Sao_Paulo");
        finalEndDatetime = start.add(duration_minutes, "minute").toISOString();
      }

      // Validar que end_datetime > start_datetime
      if (finalEndDatetime && finalStartDatetime) {
        const start = dayjs(finalStartDatetime).tz("America/Sao_Paulo");
        const end = dayjs(finalEndDatetime).tz("America/Sao_Paulo");
        if (end.isBefore(start) || end.isSame(start)) {
          return res.status(400).json({
            error: "A data/hora de término deve ser posterior à data/hora de início.",
          });
        }
      }

      // Preparar dados para atualização
      const updateData = {
        updated_at: db.fn.now(),
      };

      if (type !== undefined) updateData.type = type;
      if (patient_id !== undefined) {
        updateData.patient_id = appointmentType === "consulta" ? patient_id : null;
        // If it's a consulta and patient changed, update title with patient name
        if (appointmentType === "consulta" && patient_id) {
          const patient = await db("patients").where({ id: patient_id }).first();
          if (patient) {
            updateData.title = patient.full_name;
          }
        }
      }
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (start_datetime) updateData.start_datetime = dayjs(start_datetime).tz("America/Sao_Paulo").toISOString();
      if (finalEndDatetime) updateData.end_datetime = dayjs(finalEndDatetime).tz("America/Sao_Paulo").toISOString();
      if (duration_minutes !== undefined) updateData.duration_minutes = duration_minutes;
      if (notes !== undefined || observation !== undefined) updateData.observation = notes || observation || null;
      if (follow_up_date !== undefined) {
        // follow_up_date agora é texto (ex: "1 semana", "1 mês") e não uma data
        updateData.follow_up_date = follow_up_date || null;
      } else if (follow_up_days !== undefined && finalStartDatetime) {
        // Mantém compatibilidade com follow_up_days antigo (calcula data)
        updateData.follow_up_date = follow_up_days
          ? dayjs(finalStartDatetime).add(follow_up_days, "day").format("YYYY-MM-DD")
          : null;
      }
      if (send_confirmation !== undefined) updateData.send_reminder = send_confirmation;
      if (send_reminder !== undefined) updateData.send_reminder = send_reminder;
      if (label_id !== undefined) updateData.label_id = label_id;
      if (status !== undefined) updateData.status = status;
      if (recurrence_id !== undefined) updateData.recurrence_id = recurrence_id;

      await db("appointments").where({ id, user_id: userId }).update(updateData);

      // Buscar o appointment atualizado para obter os dados finais
      const updatedAppointment = await db("appointments")
        .where({ id, user_id: userId })
        .first();

      // Criar ou atualizar lembretes se for consulta, ou deletar se mudou para compromisso
      if (updatedAppointment) {
        if (updatedAppointment.type === "consulta") {
          const finalSendReminder = send_reminder !== undefined 
            ? send_reminder 
            : (send_confirmation !== undefined ? send_confirmation : updatedAppointment.send_reminder);
          const finalStartDatetime = start_datetime 
            ? dayjs(start_datetime).tz("America/Sao_Paulo").toISOString()
            : updatedAppointment.start_datetime;

          await createOrUpdateReminders(
            id,
            finalStartDatetime,
            finalSendReminder
          );
        } else if (type !== undefined && type !== "consulta") {
          // Se mudou de consulta para compromisso, deletar os reminders
          await db("appointment_reminders")
            .where("appointment_id", id)
            .delete();
        }
      }

      // Buscar o appointment atualizado com joins
      const appointment = await db("appointments")
        .select(
          "appointments.*",
          "patients.full_name as patient_full_name",
          "patients.cpf as patient_cpf",
          "labels.name as label_name",
          "labels.color as label_color"
        )
        .leftJoin("patients", "appointments.patient_id", "patients.id")
        .leftJoin("labels", "appointments.label_id", "labels.id")
        .where("appointments.id", id)
        .first();

      const formattedAppointment = {
        id: appointment.id,
        type: appointment.type,
        patient_id: appointment.patient_id,
        title: appointment.title,
        description: appointment.description,
        start_datetime: appointment.start_datetime,
        end_datetime: appointment.end_datetime,
        duration_minutes: appointment.duration_minutes,
        notes: appointment.observation,
        observation: appointment.observation,
        follow_up_date: appointment.follow_up_date,
        send_reminder: appointment.send_reminder,
        send_confirmation: appointment.send_reminder,
        label_id: appointment.label_id,
        status: appointment.status,
        recurrence_id: appointment.recurrence_id,
        created_at: appointment.created_at,
        updated_at: appointment.updated_at,
        patient: appointment.patient_id
          ? {
              id: appointment.patient_id,
              full_name: appointment.patient_full_name,
              cpf: appointment.patient_cpf,
            }
          : null,
        label: appointment.label_id
          ? {
              id: appointment.label_id,
              name: appointment.label_name,
              color: appointment.label_color,
            }
          : null,
      };

      return res.status(200).json(formattedAppointment);
    } catch (error) {
      console.error("Erro ao atualizar appointment:", error);
      return res.status(500).json({
        error: "Erro ao atualizar appointment.",
        details: error.message,
      });
    }
  },

  async deleteAppointment(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.user_id;

      // Deletar os reminders relacionados antes de deletar o appointment
      await db("appointment_reminders")
        .where("appointment_id", id)
        .delete();

      const deleted = await db("appointments").where({ id, user_id: userId }).delete();

      if (deleted === 0) {
        return res.status(404).json({
          error: "Appointment não encontrado ou sem permissão.",
        });
      }

      return res.status(200).json({ message: "Appointment excluído com sucesso!" });
    } catch (error) {
      console.error("Erro ao excluir appointment:", error);
      return res.status(500).json({
        error: "Erro ao excluir appointment.",
        details: error.message,
      });
    }
  },
};

