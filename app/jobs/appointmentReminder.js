const cron = require('node-cron');
const appointmentReminderService = require('../services/processAppointmentReminders.js').default;

function startAppointmentReminder() {
  cron.schedule('*/10 * * * *', async () => {
    appointmentReminderService.processAppointmentReminders();
  });
}

module.exports = startAppointmentReminder;
