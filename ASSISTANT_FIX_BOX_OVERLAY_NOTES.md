# Assistant Fix Box Overlay Patch

This patch makes the Mangaka fix box visible on Assistant task details.

## Problem
The reference image loaded, but the marked hitbox / fix area did not appear.

## Fixed
Assistant task detail now overlays the hitbox rectangle on top of the reference image.

It reads coordinates from:

- `task.xCoord`
- `task.yCoord`
- `task.width`
- `task.height`
- or nested `task.hitbox.xCoord`, `task.hitbox.yCoord`, etc.

## Also added
A clear callout box over the image:

- `What Mangaka needs fixed`
- the task description
- hitbox coordinates

The Director Notes panel also now shows the fix request and coordinates.

## Changed files
- `src/pages/assistant/assistant.js`
- `src/assets/css/style-workspace.css`
- `src/style-workspace.css`

## Backend requirement
The backend task response must include hitbox coordinates. The previous backend patch added these fields through `TaskResponse`.
