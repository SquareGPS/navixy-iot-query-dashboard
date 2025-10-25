# SQL Report Dashboard - Enhanced Section Management

## Overview

This document outlines the comprehensive section management system implemented for the SQL Report Dashboard, including drag-and-drop functionality, nested sections, deletion handling, and bulk operations.

## Features Implemented

### 1. Drag-and-Drop Reordering

**Sections:**
- Drag sections to reorder them globally
- Visual feedback during drag operations
- Automatic persistence to database
- Error handling with rollback on failure

**Reports:**
- Drag reports within the same section to reorder
- Drag reports between sections to move them
- Maintains proper sort indices
- Real-time UI updates with database sync

### 2. Section Deletion

**Smart Deletion:**
- Confirmation dialog before deletion
- Automatic handling of nested reports
- Option to move reports to root level or another section
- Prevents accidental data loss

**API Endpoints:**
- `DELETE /api/sections/:id` - Delete section with optional report migration
- Query parameter `moveReportsToSection` to specify target section

### 3. Enhanced UI Components

**Visual Indicators:**
- Grip handles appear on hover for draggable items
- Dropdown menus for context actions
- Loading states during operations
- Toast notifications for user feedback

**Accessibility:**
- Keyboard navigation support
- Screen reader friendly
- Focus management
- ARIA labels and descriptions

### 4. Nested Sections Support

**Database Schema:**
- `parent_section_id` - References parent section
- `depth` - Hierarchical depth level
- `path` - Full hierarchical path (e.g., "parent/child/grandchild")
- Circular reference prevention triggers

**API Features:**
- Hierarchical section retrieval
- Automatic path updates
- Depth-based sorting
- Parent-child relationship validation

### 5. Bulk Operations

**Reordering APIs:**
- `PUT /api/sections/reorder` - Bulk section reordering
- `PUT /api/reports/reorder` - Bulk report reordering
- Transaction-based updates for consistency
- Rollback on any failure

## Technical Implementation

### Frontend Architecture

**Dependencies Added:**
```json
{
  "@dnd-kit/core": "^6.0.8",
  "@dnd-kit/sortable": "^7.0.2",
  "@dnd-kit/utilities": "^3.2.1"
}
```

**Key Components:**
- `SortableSection` - Draggable section component
- `SortableReport` - Draggable report component
- `DndContext` - Drag and drop context provider
- `SortableContext` - Sortable item context

### Backend Architecture

**Database Functions:**
- `get_section_hierarchy()` - Returns sections in hierarchical order
- `prevent_circular_section_reference()` - Prevents circular references
- `update_section_paths()` - Updates hierarchical paths
- `update_section_path_on_change()` - Automatic path updates

**API Endpoints:**
```
GET    /api/sections              - Get all sections (hierarchical)
POST   /api/sections              - Create section (with optional parent)
PUT    /api/sections/:id          - Update section
DELETE /api/sections/:id          - Delete section
PUT    /api/sections/reorder      - Bulk reorder sections
PUT    /api/reports/reorder       - Bulk reorder reports
```

### Database Schema

**Sections Table:**
```sql
CREATE TABLE public.sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sort_index INTEGER NOT NULL DEFAULT 0,
  parent_section_id UUID REFERENCES public.sections(id) ON DELETE CASCADE,
  depth INTEGER NOT NULL DEFAULT 0,
  path TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Reports Table:**
```sql
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subtitle TEXT,
  slug TEXT,
  report_schema JSONB NOT NULL,
  section_id UUID REFERENCES public.sections(id) ON DELETE SET NULL,
  sort_index INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Usage Examples

### Creating Nested Sections

```typescript
// Create root section
const rootSection = await apiService.createSection("Analytics", 0);

// Create child section
const childSection = await apiService.createSection("User Metrics", 0, rootSection.id);
```

### Drag and Drop Operations

```typescript
// Reorder sections
const sectionsToUpdate = [
  { id: "section1", sort_index: 0 },
  { id: "section2", sort_index: 1 },
  { id: "section3", sort_index: 2 }
];
await apiService.reorderSections(sectionsToUpdate);

// Move report between sections
await apiService.reorderReports([{
  id: "report1",
  sort_index: 0,
  section_id: "new-section-id"
}]);
```

### Section Deletion

```typescript
// Delete section, move reports to root
await apiService.deleteSection("section-id");

// Delete section, move reports to another section
await apiService.deleteSection("section-id", "target-section-id");
```

## Migration Guide

### Running the Migration

1. **Apply Database Migration:**
```bash
psql -d reports_app_db -f migrations/add_nested_sections.sql
```

2. **Update Backend:**
```bash
cd backend
npm run build
npm start
```

3. **Update Frontend:**
```bash
npm install
npm run dev
```

### Breaking Changes

- Section creation API now accepts `parent_section_id` parameter
- Section deletion API now accepts `moveReportsToSection` query parameter
- Section retrieval returns hierarchical data with `depth` and `path` fields

## Performance Considerations

### Database Optimization

- **Indexes:** Added on `parent_section_id` for fast parent lookups
- **Functions:** Optimized recursive queries for hierarchy traversal
- **Triggers:** Automatic path updates prevent manual maintenance

### Frontend Optimization

- **Virtual Scrolling:** Consider for large section hierarchies
- **Debouncing:** API calls debounced during rapid drag operations
- **Caching:** Section hierarchy cached in component state

## Security Considerations

### Authorization

- All section operations require admin/editor role
- User context passed to all database operations
- Audit logging for all section modifications

### Data Validation

- Circular reference prevention at database level
- Input validation for section names and hierarchy
- SQL injection prevention through parameterized queries

## Future Enhancements

### Planned Features

1. **Section Templates:** Pre-defined section structures
2. **Bulk Import/Export:** Section hierarchy backup/restore
3. **Advanced Permissions:** Section-level access control
4. **Section Analytics:** Usage statistics and metrics
5. **Section Search:** Full-text search within hierarchies

### Performance Improvements

1. **Lazy Loading:** Load section children on demand
2. **Pagination:** Handle very large section hierarchies
3. **Caching:** Redis caching for frequently accessed hierarchies
4. **Optimistic Updates:** Immediate UI updates with background sync

## Troubleshooting

### Common Issues

1. **Circular Reference Error:**
   - Check for sections trying to be their own parent
   - Verify migration script ran successfully

2. **Drag and Drop Not Working:**
   - Ensure user has admin/editor role
   - Check browser console for JavaScript errors
   - Verify drag-and-drop libraries are installed

3. **Section Deletion Fails:**
   - Check for foreign key constraints
   - Verify reports can be moved to target section
   - Check database transaction logs

### Debug Mode

Enable debug logging by setting environment variable:
```bash
DEBUG=sql-report-dash:*
```

This will provide detailed logs for all section operations and API calls.
