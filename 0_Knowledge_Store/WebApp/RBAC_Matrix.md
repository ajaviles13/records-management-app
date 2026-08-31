# Role-Based Access Control Matrix

The four roles are stored in the `role_access` column of `data/sla-users.csv`. The literal
values are exactly:

- `Analyst`
- `Manager`
- `Administrator`
- `Viewer`

> **Naming note.** Product discussions refer to this role as "Admin". The stored and
> in-code value is always `Administrator`. There is no `Admin` literal anywhere in the
> codebase. Do not introduce one.

`src/lib/roles.ts` is the single source of truth for every capability below. UI code and
server code must both call those helpers rather than comparing role strings inline.

## Tab visibility

| Tab | Path | Analyst | Manager | Administrator | Viewer |
| --- | --- | --- | --- | --- | --- |
| Records | `/records` | Yes | Yes | Yes | No |
| My Snapshot | `/snapshot` | Yes | Yes | Yes | No |
| Audit Log | `/audit` | No | No | Yes | No |
| Dashboard | `/dashboard` | No | Yes | Yes | Yes |
| Configure | `/configure` | No | Yes | Yes | No |
| Configure > Users | `/configure/users` | No | Yes | Yes | No |
| Configure > Connectors | `/configure/connectors` | No | No | Yes | No |
| Account | `/account` | Yes | Yes | Yes | Yes |

Enforced by `NAV_ITEMS`, `navItemsFor(role)`, and `canAccess(role, path)`. `Configure` is
the first nav entry with `children`, so any consumer of `NAV_ITEMS` must handle nesting.

## Capabilities

| Capability | Helper | Analyst | Manager | Administrator | Viewer |
| --- | --- | --- | --- | --- | --- |
| Create and edit records | `canEditRecords` | Yes | Yes | Yes | No |
| Reassign `assigned_analyst_id` | `canAssignRecords` | No | Yes | Yes | No |
| Use saved views | `canUseSavedViews` | Yes | Yes | Yes | No |
| Share a view with users or roles | `canAssignViews` | No | Yes | Yes | No |
| Edit or delete a given view | `canEditView` | Owner only | Owner only | Owner only | No |
| Export the current view | `canExport` | Yes | Yes | Yes | No |
| Add and remove users | `canManageUsers` | No | Yes | Yes | No |
| Configure connectors | `canSeeConnectors` | No | No | Yes | No |
| See team-wide numbers in My Snapshot | `seesAllRecords` | No | Yes | Yes | No |

An Administrator inherits everything a Manager can do, plus the Audit Log and Connectors.

## Role hierarchy for user administration

`assignableRoles(role)` governs which roles a user may grant or revoke on
Configure > Users:

| Actor | May create or remove |
| --- | --- |
| Administrator | Analyst, Manager, Administrator, Viewer |
| Manager | Analyst, Manager, Viewer |
| Analyst, Viewer | none |

A Manager therefore cannot create an Administrator, and cannot remove an existing one.
No user may remove their own account.

## Edge cases

- **Viewers and saved views.** Viewers have no access to saved views at all, so a Viewer
  is never a valid assignment target and `GET /api/views` returns an empty list for them.
  `isAssignableRole` in `server/index.ts` rejects `Viewer` explicitly.
- **Inherited views are read-only.** Receiving a view through `assigned_user_ids` or
  `assigned_roles` grants selection only. `canEditView` compares `owner_user_id`, so
  recipients see no pencil icon and the server rejects their `PATCH` and `DELETE`.
- **Server-side enforcement.** The Express layer resolves the actor by looking the
  `x-user-id` header up in `data/sla-users.csv`. A client-supplied role is never trusted.
  This is a development stand-in for the eventual AWS Cognito integration.
- **Analyst self-service.** An Analyst may edit other fields on a record assigned to
  them, but any patch that changes `assigned_analyst_id` is rejected with a 403.
