/**
 * Universal Pagination, Search, and Sorting Query Helper
 * Designed for High-Throughput PostgreSQL Multi-Tenant Applications
 */

function parsePagination(query, defaults = { page: 1, limit: 10, maxLimit: 100 }) {
  const rawPage = parseInt(query.page, 10);
  const rawLimit = parseInt(query.limit, 10);

  const page = !isNaN(rawPage) && rawPage > 0 ? rawPage : defaults.page;
  const limit = !isNaN(rawLimit) && rawLimit > 0
    ? Math.min(rawLimit, defaults.maxLimit || 100)
    : defaults.limit;
  const offset = (page - 1) * limit;

  const search = typeof query.search === 'string' ? query.search.trim() : '';
  const sortBy = typeof query.sortBy === 'string' ? query.sortBy.trim() : 'id';
  const sortDir = (query.sortDir || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  return {
    page,
    limit,
    offset,
    search,
    sortBy,
    sortDir,
  };
}

function buildPaginatedResponse(items, totalCount, page, limit) {
  const total = parseInt(totalCount, 10) || 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return {
    success: true,
    data: items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

module.exports = {
  parsePagination,
  buildPaginatedResponse,
};
