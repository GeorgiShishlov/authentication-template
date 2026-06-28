function createPageViewModel(db) {
  function startOfDay(daysAgo = 0) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }

  return {
    async track(path) {
      await db.run('INSERT INTO page_views (path) VALUES (?)', [path]);
    },

    async getStats() {
      const todayStart = startOfDay(0);
      const weekStart  = startOfDay(6);
      const monthStart = startOfDay(29);

      const [total, today, week, byPage, byDay] = await Promise.all([
        db.get('SELECT COUNT(*) as count FROM page_views'),
        db.get('SELECT COUNT(*) as count FROM page_views WHERE created_at >= ?', [todayStart]),
        db.get('SELECT COUNT(*) as count FROM page_views WHERE created_at >= ?', [weekStart]),
        db.all(
          'SELECT path, COUNT(*) as count FROM page_views GROUP BY path ORDER BY count DESC LIMIT 20',
        ),
        db.all(
          `SELECT DATE(created_at) as day, COUNT(*) as count FROM page_views
           WHERE created_at >= ? GROUP BY DATE(created_at) ORDER BY day ASC`,
          [monthStart],
        ),
      ]);

      return {
        total:  Number(total?.count  ?? 0),
        today:  Number(today?.count  ?? 0),
        week:   Number(week?.count   ?? 0),
        byPage,
        byDay,
      };
    },
  };
}

module.exports = { createPageViewModel };
