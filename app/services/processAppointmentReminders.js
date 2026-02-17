import db from '../database/index.js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import twilio from 'twilio';

dayjs.extend(utc);
dayjs.extend(timezone);

const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioFrom = process.env.TWILIO_WHATSAPP_FROM;
const twilioContentSid24h = process.env.TWILIO_CONTENT_SID_24H;
const twilioContentSid2h = process.env.TWILIO_CONTENT_SID_2H;

let twilioClient = null;
if (twilioAccountSid && twilioAuthToken) {
  twilioClient = twilio(twilioAccountSid, twilioAuthToken);
}

function isValidWhatsAppPhone(phone) {
  if (!phone) return false;

  const cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length !== 11) return false;

  const ddd = parseInt(cleanPhone.substring(0, 2), 10);
  if (isNaN(ddd) || ddd < 11 || ddd > 99) return false;

  if (cleanPhone[2] !== '9') return false;
  return true;
}


async function sendReminderViaWhatsApp(reminder, appointment) {
  if (!twilioClient || !twilioFrom) {
    console.warn('Twilio não configurado. Lembrete não será enviado.');
    return false;
  }

  try {
    const appointmentDate = dayjs(appointment.start_datetime).tz('America/Sao_Paulo').format('DD/MM/YYYY');
    const appointmentTime = dayjs(appointment.start_datetime).tz('America/Sao_Paulo').format('HH:mm');
    const patientName = appointment.patient_name;
    const patientPhone = `whatsapp:+55${appointment.patient_phone}`;
    const clinicName = appointment.clinic_name;

    let contentSid = reminder.template_type;
    let contentVariables;

    if (contentSid === 'twilioContentSid24h') {
      contentSid = twilioContentSid24h;
      contentVariables = JSON.stringify({
        1: patientName,
        2: appointmentDate,
        3: appointmentTime,
        4: clinicName
      });
    } else if (contentSid === 'twilioContentSid2h') {
      contentSid = twilioContentSid2h;
      contentVariables = JSON.stringify({
        1: patientName,
        2: appointmentTime,
        3: clinicName
      });
    }

    await twilioClient.messages.create({
      from: twilioFrom,
      to: patientPhone,
      contentSid: contentSid,
      contentVariables: contentVariables
    });

    console.log(`Lembrete enviado para ${patientName} - (${patientPhone})`);

    return true;
  } catch (error) {
    console.error(`Erro ao enviar lembrete para appointment ${appointment.id}:`, error.message);
    return false;
  }
}

async function processAppointmentReminders() {
  try {
    console.log('Processando lembretes...');

    const now = dayjs().tz('America/Sao_Paulo');
    const nowISO = now.toISOString();

    const pendingReminders = await db('appointment_reminders')
      .where('status', 'pending')
      .where('send_at', '<=', nowISO)
      .orderBy('send_at', 'asc')
      .limit(50);

      console.log(pendingReminders)
    if (pendingReminders.length === 0) {
      return;
    }

    console.log(`📬 Processando ${pendingReminders.length} lembrete(s) pendente(s)...`);

    for (const reminder of pendingReminders) {
      try {
        const appointment = await db('appointments')
          .select(
            'appointments.*',
            'patients.full_name as patient_name',
            'patients.phone as patient_phone',
            'users.name as clinic_name'
          )
          .leftJoin('patients', 'appointments.patient_id', 'patients.id')
          .leftJoin('users', 'appointments.user_id', 'users.id')
          .where('appointments.id', reminder.appointment_id)
          .first();

        if (!isValidWhatsAppPhone(appointment.patient_phone) || !appointment.patient_phone) {
          console.warn(`appointment ${appointment.id} com telefone inválido. Pulando lembrete.`);
          await db('appointment_reminders')
            .where('id', reminder.id)
            .update({
              status: 'error',
              sent_at: db.fn.now()
            });
          continue;
        }

        console.log('appointment', appointment);
        await sendReminderViaWhatsApp(reminder, appointment);

        await db('appointment_reminders')
          .where('id', reminder.id)
          .update({
            status: 'sent',
            sent_at: db.fn.now(),
            sent_count: db.raw('sent_count + 1'),
          });

      } catch (error) {
        console.error(`Erro ao processar lembrete ${reminder.id}:`, error);
        await db('appointment_reminders')
          .where('id', reminder.id)
          .update({
            status: 'error',
            sent_at: db.fn.now(),
            sent_count: db.raw('sent_count + 1')
          });
      }
    }
    console.log(`Processamento de lembretes concluído.`);
  } catch (error) {
    console.error('Erro ao processar lembretes de consultas:', error);
    throw error;
  }
}

export default {
  processAppointmentReminders
};
