# Synthetic Core Workflow Protocol

This protocol measures Discovery usability and scope relevance. It does not claim O-001 or O-002.

## Environment

- Use the same tested OpenLinear build for every session and record its source and build identity.
- Use a current stable desktop browser at 1440x900 or the participant's normal desktop viewport, recording the actual dimensions.
- Create a fresh, isolated synthetic workspace for each participant.
- Do not disclose shared credentials in the record. The moderator establishes the session before observation.
- Do not open Linear or another competitor.
- Disable notifications and unrelated browser tabs.

## Moderator Rules

Read each task exactly. Answer clarification questions only by restating the goal. Record the first intervention; after that the moderator may help the participant continue, but the task is unsuccessful for unassisted completion.

Start time is the end of the task prompt. End time is the first visible persisted state satisfying the task. A critical error is data loss, cross-workspace disclosure, inability to recover the workflow, or a blocker that prevents later tasks.

## Scenario

You are coordinating a synthetic mobile-app release. The workspace contains no employer or real customer data.

## Tasks

### T01 Orient

Find the active project that is closest to its target date and state its current milestone progress.

Success: correct project and progress are identified without assistance.

### T02 Plan a Project

Create a project named `Mobile launch` with a target date supplied on the session card and set it active.

Success: the project is visibly persisted with the requested state and date.

### T03 Add Milestones

Add `Design ready` and `Release candidate` milestones in that order.

Success: both milestones are persisted and ordered correctly.

### T04 Capture Work

Create an issue named `Audit empty states`, associate it with `Mobile launch` and `Design ready`, set high priority, and leave it ready to start.

Success: one issue exists with all requested properties and no duplicate.

### T05 Build a Review View

Create or save a view that shows open `Mobile launch` issues and name it `Launch review`.

Success: the saved view can be reopened and includes the created issue.

### T06 Edit in Context

Open `Audit empty states` from the filtered issue list, add the description `Cover projects, milestones, and issues.`, move it to an active workflow state, then return to the same filtered context.

Success: changes persist and the prior context is preserved without assistance.

### T07 Find and Relate

Use workspace search or command navigation to find `Audit empty states`, then add a blocking or related issue using another synthetic issue supplied on the session card.

Success: the intended issue is found and the relation is visible in the correct direction.

### T08 Verify Persistence

Refresh the application, reopen `Mobile launch`, and verify the project, ordered milestones, saved view, issue properties, description, and relation remain present.

Success: every requested record and relation survives refresh with no critical error.

## Per-Task Record

Record:

- success: yes/no;
- elapsed seconds;
- pointer, keyboard, or mixed path;
- intervention: none, clarification, hint, direct help;
- errors and recoveries;
- confidence from 1 to 5;
- concise observed friction, paraphrased without identifying data.

After T08, ask which tasks match real work, which are unnecessary, and which migration-critical task is missing.
