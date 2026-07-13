Patch: Hide assistant upload form for approved/reviewing tasks

Problem:
- Assistant Assignments still showed “Submit Finished Work to Mangaka” for tasks already APPROVED.
- Approved tasks could still show status move buttons, which made the workflow look editable after final approval.

Fixed:
- APPROVED tasks now show a locked/approved notice instead of the upload form.
- REVIEWING tasks now show a locked/submitted notice instead of the upload form.
- APPROVED task cards/details no longer show movement buttons.
- Reference/submitted images still remain visible for review/history.
- Backend was not changed.

Changed files:
- src/pages/TasksPage.jsx
- src/styles.css
