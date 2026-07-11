Patch: Frontend image URL display fix

Fixed:
- Backend snake_case image fields are now recognized:
  cover_image_url, image_url, file_url, resource_url, page_image_url, reference_image_url, submitted_image_url, etc.
- Series cards now show uploaded cover images instead of initials.
- Dashboard series list and latest series now show covers.
- Assistant task thumbnails now show the page/reference/submitted image when returned by backend.
- Manuscripts, Chapters & Pages, Canvas Workspace, Series Detail, Tantou Review, and Mangaka Review use the same robust media resolver.
- Added CSS so image thumbnails cover their boxes instead of appearing blank or clipped.

Backend was not changed.
