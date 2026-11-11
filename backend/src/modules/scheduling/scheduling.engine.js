/**
 * Scheduling engine: slot computation, overlap detection, conflict resolution
 */

class SchedulingEngine {
  /**
   * Check if a proposed appointment window overlaps with any existing appointments.
   * @param {Array} existingAppointments - Array of appointment objects with scheduled_at and duration_min
   * @param {Date|string} newStart - Start time of candidate appointment
   * @param {number} durationMin - Duration in minutes
   * @param {number|null} excludeAppointmentId - Optional ID to ignore (e.g. when updating existing appointment)
   * @returns {Object|null} Conflicting appointment or null if clear
   */
  detectConflict(existingAppointments, newStart, durationMin, excludeAppointmentId = null) {
    const start = new Date(newStart).getTime();
    const end = start + durationMin * 60 * 1000;

    for (const apt of existingAppointments) {
      if (excludeAppointmentId && apt.id === excludeAppointmentId) continue;
      if (apt.status === 'cancelled') continue;

      const aptStart = new Date(apt.scheduled_at).getTime();
      const aptEnd = aptStart + (apt.duration_min || 15) * 60 * 1000;

      // Overlap condition: start < aptEnd AND end > aptStart
      if (start < aptEnd && end > aptStart) {
        return apt;
      }
    }

    return null;
  }

  /**
   * Generate available slots for a given date and doctor's schedule.
   * @param {string} dateStr - 'YYYY-MM-DD'
   * @param {Array} availabilityBlocks - [{ start_time: '09:00:00', end_time: '17:00:00', slot_minutes: 15 }]
   * @param {Array} dayAppointments - Active appointments on that day for that doctor
   * @returns {Array} List of slots with availability status
   */
  generateSlotsForDate(dateStr, availabilityBlocks, dayAppointments) {
    const slots = [];

    for (const block of availabilityBlocks) {
      const slotMin = block.slot_minutes || 15;
      const [startH, startM] = block.start_time.split(':').map(Number);
      const [endH, endM] = block.end_time.split(':').map(Number);

      const blockStart = new Date(`${dateStr}T${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}:00Z`);
      const blockEnd = new Date(`${dateStr}T${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00Z`);

      let current = new Date(blockStart);
      while (current.getTime() + slotMin * 60 * 1000 <= blockEnd.getTime()) {
        const slotStart = new Date(current);
        const slotEnd = new Date(current.getTime() + slotMin * 60 * 1000);

        const conflict = this.detectConflict(dayAppointments, slotStart, slotMin);

        slots.push({
          startTime: slotStart.toISOString(),
          endTime: slotEnd.toISOString(),
          available: !conflict,
          durationMin: slotMin,
          bookedAppointment: conflict ? {
            id: conflict.id,
            petName: conflict.pet_name,
            reason: conflict.reason,
            status: conflict.status,
          } : null,
        });

        current = new Date(current.getTime() + slotMin * 60 * 1000);
      }
    }

    return slots;
  }
}

module.exports = new SchedulingEngine();

