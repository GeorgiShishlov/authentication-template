// src/__tests__/helpers/createTestDb.js
'use strict';

const { createDatabase } = require('../../config/database');

/**
 * Создаёт изолированную in-memory SQLite БД с полной схемой.
 * Каждый тест получает чистое состояние — никаких файлов, никаких остатков.
 *
 * Возвращает стандартный db-адаптер (run/get/all/exec).
 * Когда проект переедет на PostgreSQL — достаточно будет создать
 * pg-адаптер с тем же интерфейсом и использовать его здесь.
 */
async function createTestDb() {
  return createDatabase(':memory:');
}

module.exports = { createTestDb };
