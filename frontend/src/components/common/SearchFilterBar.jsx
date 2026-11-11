import React, { useState, useEffect } from 'react';
import { Search, X, Filter, RefreshCw } from 'lucide-react';

export function SearchFilterBar({
  searchTerm = '',
  onSearchChange,
  placeholder = 'Search by name, ID, phone, or keyword...',
  filters = [],
  onFilterChange,
  onRefresh,
  isLoading = false,
  totalResults = null,
}) {
  const [localSearch, setLocalSearch] = useState(searchTerm);

  // Synchronize incoming search prop if externally changed
  useEffect(() => {
    setLocalSearch(searchTerm);
  }, [searchTerm]);

  // Debounce search by 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      if (localSearch !== searchTerm) {
        onSearchChange(localSearch);
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [localSearch, searchTerm, onSearchChange]);

  const handleClear = () => {
    setLocalSearch('');
    onSearchChange('');
  };

  return (
    <div className="search-filter-container" role="search" aria-label="Search and Filter Controls">
      <div className="search-input-wrapper">
        <Search size={16} className="search-leading-icon" aria-hidden="true" />
        <input
          type="text"
          className="search-text-input"
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
        />
        {localSearch && (
          <button
            type="button"
            className="search-clear-btn"
            onClick={handleClear}
            aria-label="Clear search query"
            title="Clear search"
          >
            <X size={15} />
          </button>
        )}
      </div>

      <div className="filter-actions-group">
        {filters.map((f) => (
          <div key={f.id} className="filter-dropdown-wrapper">
            {f.icon && <span className="filter-icon" aria-hidden="true">{f.icon}</span>}
            <select
              className="filter-dropdown-select"
              value={f.value}
              onChange={(e) => onFilterChange(f.id, e.target.value)}
              aria-label={f.label || 'Filter options'}
            >
              {f.options.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ))}

        {onRefresh && (
          <button
            type="button"
            className="filter-refresh-btn"
            onClick={onRefresh}
            title="Refresh List"
            aria-label="Refresh results list"
            disabled={isLoading}
          >
            <RefreshCw size={15} className={isLoading ? 'spin' : ''} aria-hidden="true" />
            <span className="refresh-label">Refresh</span>
          </button>
        )}

        {totalResults !== null && (
          <div className="filter-count-badge" aria-live="polite">
            <span>{totalResults}</span> {totalResults === 1 ? 'result' : 'results'}
          </div>
        )}
      </div>
    </div>
  );
}
