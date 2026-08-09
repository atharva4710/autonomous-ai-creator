# PROMPTS.md

This repository contains the Autonomous AI Creator project developed during the hackathon.

The project was built and improved using AI-assisted development with Antigravity. The prompts below are the main prompts used while developing the autonomous agent, content generation, activity log, dashboard and final UI.

The prompts are kept in roughly the same order in which the main parts of the project were developed.

---

# Prompt 1 — Create the Autonomous AI Creator

Create a full-stack web application called "Autonomous AI Creator".

The main idea is to create an AI agent that can find topics, decide which topic is worth covering, generate content and publish it without needing the user to manually repeat the process.

The agent should be able to:

- Have its own persona
- Search for new topics
- Evaluate topics
- Remember previously used topics
- Generate content
- Create Blog, LinkedIn and X versions
- Publish the selected content
- Keep working in repeated cycles

Use:

- React for the frontend
- TypeScript and Node.js for the backend
- PostgreSQL for persistent data
- Groq for AI generation

Keep the code separated into services so that discovery, editorial selection, memory, content generation and publishing are not all handled in one file.

The UI should be simple and easy to understand.

---

# Prompt 2 — Create the Agent Persona

Add a persona system for the autonomous agent.

Each agent should have:

- Name
- Domain
- Role
- Description
- Interests
- Expertise
- Tone
- Editorial principles

Example:

```json
{
  "name": "Ada",
  "domain": "AI Security",
  "role": "AI Security Researcher",
  "description": "Focuses on practical AI security risks and developments.",
  "interests": [
    "LLM security",
    "AI agents",
    "prompt injection",
    "AI privacy"
  ],
  "expertise": [
    "AI security",
    "machine learning",
    "LLM vulnerabilities"
  ],
  "tone": [
    "analytical",
    "technical",
    "concise"
  ],
  "editorialPrinciples": [
    "Evidence over hype",
    "Focus on practical implications"
  ]
}
```

The persona should be used when searching for topics and when generating the final content.

Make sure the persona can be stored and loaded from the backend.

---

# Prompt 3 — Persona Validation

Add validation for the agent persona.

Make sure the required persona fields are present before creating an agent.

Check things such as:

- Name
- Domain
- Role
- Description
- Interests
- Expertise
- Tone
- Editorial principles

Return useful validation errors instead of allowing incomplete personas to enter the autonomous system.

Keep the validation simple and reusable.

---

# Prompt 4 — Topic Discovery

Create the topic discovery service.

The agent should find recent topics from live sources instead of using hardcoded topics.

Use RSS sources such as:

- TechCrunch AI
- Hacker News
- Google News

Also create Google News queries using the agent's domain and interests.

For example, if the domain is AI Security, the agent should be able to search for topics related to:

- AI security
- LLM security
- prompt injection
- AI agents
- AI privacy

For each topic, store useful information such as:

- Title
- Summary
- Source
- Source URL
- Published date

Clean the RSS data before saving it.

Add a timeout so that a slow external source does not block the whole autonomous cycle.

---

# Prompt 5 — Improve Domain Search

Improve the domain search so that the agent does not search only for the exact persona domain.

Create an `expandDomainQueries` utility.

Use the persona domain together with interests and other useful terms to create better search queries.

For example:

- AI Security
- AI Security LLM security
- AI Security prompt injection
- AI Security AI agents

Keep the number of generated queries limited so that every autonomous cycle does not make unnecessary requests.

---

# Prompt 6 — Editorial Topic Selection

Add an editorial scoring system for discovered topics.

The agent should not send every discovered topic to the LLM.

Score each topic using:

- Relevance
- Persona Alignment
- Timeliness
- Importance
- Novelty
- Source Quality

Use these weights:

| Factor | Weight |
|---|---|
| Relevance | 25% |
| Persona Alignment | 20% |
| Timeliness | 15% |
| Importance | 15% |
| Novelty | 15% |
| Source Quality | 10% |

Calculate an overall score from these values.

Use 65 as the current overall acceptance threshold.

Also keep minimum requirements for relevance and timeliness.

After scoring, sort the accepted candidates by their overall score.

The highest scoring eligible topic should be tried first.

Keep this logic in the backend instead of asking the LLM to decide which topic is best.

---

# Prompt 7 — Improve Topic Evaluation

Make the editorial scoring more useful instead of using random scores.

For relevance, check how closely the topic matches the agent's domain.

For persona alignment, use the interests and expertise of the persona.

For timeliness, use the published date.

For importance, look for useful signals in the topic.

For novelty, look for signs that the topic contains a new model, version, release or development.

For source quality, give more weight to reliable sources.

Keep the scoring predictable so that the same type of topic gets a similar score each time.

---

# Prompt 8 — Remember Previous Topics

Add memory for the autonomous agent.

The agent should remember topics that it has:

- Discovered
- Evaluated
- Accepted
- Rejected
- Published

Before selecting a new topic, check whether it already exists in the agent's history.

Use several checks:

- Topic ID
- Topic title and source
- Normalized title
- Important keywords

Do not treat common words such as "AI", "security", "model", "system", "new" and similar general words as enough to call two stories duplicates.

The purpose is to prevent the agent from publishing the exact same story again while still allowing different stories from the same domain.

---

# Prompt 9 — Add Repetition Penalty

If a topic is similar to something already seen by the agent, reduce its editorial score instead of always rejecting it.

If the topic has already been published, skip it completely.

This allows the agent to keep covering a domain while giving preference to new stories.

Make the memory check happen before final topic selection.

---

# Prompt 10 — Add Groq AI Provider

Add Groq as the production AI provider.

Use:

`llama-3.3-70b-versatile`

Create an AI provider interface so that the content-generation service does not directly depend on Groq.

The application should be able to use:

```text
IAIProvider
    ↓
GroqAIProvider
```

Also keep a mock provider for tests and local development where required.

Do not put the API key directly in the code.

Read it from the environment.

---

# Prompt 11 — Create the Main Content Generation Prompt

Create the main system prompt used by the AI provider.

The prompt should tell the model:

- Who the agent is
- What the agent's role is
- What domain it works in
- What tone it should use
- What editorial principles it should follow

Then provide the selected topic and source information.

Use a structure similar to:

```text
You are {persona.name}, a technology professional working as a
{persona.role} specializing in {persona.domain}.

PERSONA:
Domain: {persona.domain}
Role: {persona.role}
Description: {persona.description}
Tone: {persona.tone}
Editorial principles: {persona.editorialPrinciples}

Write about the selected topic using the information provided.

Keep the content factual and based on the supplied information.
Do not invent facts, quotes or sources.
Avoid unnecessary hype and generic writing.
```

Make the prompt dynamic so that it changes according to the active agent persona.

---

# Prompt 12 — Avoid Generic AI Writing

Improve the content prompt so that the generated writing feels more natural.

Tell the model not to repeatedly use phrases such as:

- "In today's rapidly evolving world"
- "In the ever-changing landscape"
- "It is important to note"
- "Let's dive in"
- "In conclusion"
- "This groundbreaking development"

Also avoid prefixes such as:

- "Here is your blog post"
- "Here is a LinkedIn post"
- "Sure! Here is..."

The model should start directly with the actual content.

Keep the writing specific to the selected topic instead of making generic statements about AI or technology.

---

# Prompt 13 — Blog Generation

Generate a detailed Blog version of the selected topic.

Target around 500–800 words.

Use a clear structure such as:

```markdown
## What Happened

## Why It Matters

## Practical Implications

## Key Takeaways

## Final Take
```

The article should:

- Explain the actual development
- Use the source information provided
- Stay related to the persona's domain
- Give practical implications
- Avoid unnecessary hype
- Avoid invented facts
- Have a natural writing style

Do not simply copy the source article.

---

# Prompt 14 — LinkedIn Generation

Generate a separate LinkedIn version of the same topic.

Target around 180–300 words.

Include:

- A clear opening
- Short explanation of the development
- Practical or industry impact
- Important points
- A professional perspective
- Relevant hashtags

The LinkedIn post should not just be a shortened version of the Blog.

It should be written specifically for someone scrolling through LinkedIn.

---

# Prompt 15 — X Post Generation

Generate a short X post for the same topic.

Requirements:

- Under 280 characters
- Focus on the main point
- Direct writing
- No unnecessary introduction
- Relevant hashtags where useful

Make sure the final result is checked by the application before publishing.

---

# Prompt 16 — Generate All Three Formats Together

Generate:

- Blog
- LinkedIn
- X

in one LLM request.

Return the result as JSON:

```json
{
  "blog": "...",
  "linkedin": "...",
  "x": "..."
}
```

The three formats should use the same selected topic and source information.

The goal is to keep the facts and main idea consistent while still making each format different.

Using one request also reduces the number of API calls.

---

# Prompt 17 — Add Editorial Reasoning

Store the reason why a topic was selected.

Keep information such as:

- Relevance score
- Persona alignment score
- Timeliness score
- Importance score
- Novelty score
- Source quality score
- Overall score
- Selection reason

If possible, also keep information about the other candidates that were considered.

The frontend should be able to show the user why a particular topic was selected.

---

# Prompt 18 — Validate Generated Content

Do not publish LLM output immediately.

Add a validation step before publishing.

Check that:

- Content is not empty
- Blog exists
- LinkedIn exists
- X exists
- Blog and LinkedIn are not identical
- LinkedIn and X are not identical
- X is not longer than 280 characters
- Content does not contain placeholders
- Content does not contain common banned AI phrases
- Content stays within the allowed length

Examples of text that should be rejected:

- `[insert name]`
- `[placeholder]`
- `here is your post`
- `rapidly evolving landscape`
- `ever-changing world`
- `todo:`

If validation fails, do not publish the content.

---

# Prompt 19 — Handle Groq Errors

Handle temporary Groq errors without stopping the entire autonomous agent.

Add retry handling for things such as:

- Network errors
- Timeouts
- Temporary provider errors
- Rate limits

If the request still fails after the allowed attempts:

- Do not publish incomplete content
- Record the error
- Record the failed cycle
- Keep the autonomous loop alive
- Allow a later cycle to try again

If the agent becomes DEGRADED, allow it to return to RUNNING after a successful cycle.

---

# Prompt 20 — Candidate Fallback

If the highest-ranked topic cannot be generated or published, do not immediately stop the whole cycle.

Try the next eligible candidate.

For example:

```text
Candidate 1
    ↓
Generation fails
    ↓
Candidate 2
    ↓
Try generation again
```

Only finish the cycle without publishing when no usable candidate remains.

Record the failures in the activity log.

---

# Prompt 21 — Autonomous Agent Loop

Create the autonomous loop.

The agent should be able to run without the user manually starting every generation.

The cycle should be:

```text
Find topics
    ↓
Check memory
    ↓
Score topics
    ↓
Select topic
    ↓
Generate content
    ↓
Validate content
    ↓
Publish
    ↓
Update memory
    ↓
Update activity
    ↓
Wait
    ↓
Run again
```

The current production interval is:

900000 ms

which is 15 minutes.

Make sure that starting an agent twice does not create two timers for the same agent.

---

# Prompt 22 — Restore Active Agents

Handle server restarts.

When the backend starts, check the stored agent information and restore active autonomous loops where required.

If a cycle was missed while the server was down and its next cycle time has already passed, handle it instead of simply waiting for another full interval.

Keep the stored agent state as the source for deciding which agents should be running.

---

# Prompt 23 — Activity Log

Create an Activity Log for the autonomous agent.

The user should be able to see what the agent is doing instead of only seeing the final post.

Show real events from the backend.

Useful events include:

- Agent started
- Cycle started
- Topics discovered
- Topic evaluated
- Topic selected
- Content generated
- Content validated
- Post published
- Memory updated
- AI error
- Cycle failed
- Agent recovered

Each activity should show:

- Time
- Event name
- Short description
- Topic when available
- Status when available

Do not use fake activity data.

The Activity Log should make it easy for the evaluator to understand that the agent is actually working by itself.

---

# Prompt 24 — Activity Log UI

Improve the Activity Log page.

Make it look like a real monitoring page instead of a plain database table.

Use a simple timeline/list style.

Example:

```text
20:36:12
Agent Started
Ada started autonomous operation

20:36:15
Topics Discovered
8 new topics found

20:36:17
Topic Selected
AI security vulnerability
Score: 88

20:36:20
Content Generated
Blog, LinkedIn and X created

20:36:22
Post Published
Post successfully added to feed
```

Use the actual backend activity data.

Do not hardcode these examples.

Keep the text short so that the user can quickly understand what happened.

---

# Prompt 25 — Agent Dashboard

Create the main dashboard for the autonomous agent.

The dashboard should show:

- Agent name
- Domain
- Current status
- Next cycle
- Latest activity
- Latest selected topic
- Latest post
- Publishing information

Make the current state easy to understand.

The user should immediately know whether the agent is:

- RUNNING
- STOPPED
- DEGRADED

Do not fill the dashboard with unnecessary information.

---

# Prompt 26 — Agent Status and Controls

Add controls for the autonomous agent.

The user should be able to:

- Start the agent
- Stop the agent
- See its current status
- See the next scheduled cycle

When the agent is already running, do not create another loop.

Show useful feedback when an action succeeds or fails.

---

# Prompt 27 — Discovery Page

Create a page where the user can see discovered topics.

Show information such as:

- Topic title
- Source
- Published time
- Relevance
- Editorial score
- Selection status

Allow the user to understand which topics were considered before a final topic was selected.

Keep the layout simple.

---

# Prompt 28 — Editorial Explanation

Add an explanation view for selected posts.

When the user opens the explanation, show why the topic was selected.

Display the available scores:

- Relevance
- Persona Alignment
- Timeliness
- Importance
- Novelty
- Source Quality
- Overall

Also show the selection reason when available.

If alternative candidates are stored, show them as well.

The purpose is to make the agent's decision easier to understand.

---

# Prompt 29 — Content Feed

Create the main content feed.

Show generated posts in a clean format.

A post should make it clear:

- Which agent created it
- What topic it is about
- When it was created
- Which format is being viewed
- Whether it was successfully published

Allow the user to switch between:

- Blog
- LinkedIn
- X

Keep the content readable instead of trying to show everything on one screen.

---

# Prompt 30 — Backend API Connection

Connect the frontend to the backend API.

Keep API calls inside:

`frontend/src/services/api.ts`

The frontend should be able to communicate with the backend for:

- Agent creation
- Agent start
- Agent stop
- Agent status
- Activity
- Discovery
- Content generation
- Feed
- Editorial explanation

Do not put repeated fetch logic directly inside every component.

Use the existing backend API structure.

---

# Prompt 31 — Improve Dashboard Layout

Improve the dashboard layout so that the user can easily move between different parts of the application.

Use a clear structure with:

- Left navigation
- Main content
- Right contextual information where useful

Use the available space properly.

Avoid large empty areas on the left and right.

Keep the most important information in the center.

Do not make the interface feel crowded.

---

# Prompt 32 — Navigation and User Experience

Make navigation simple.

The user should be able to easily reach:

- Dashboard
- Activity Log
- Discovery
- Content Feed
- Editorial Explanation
- Agent information

Keep the current page clearly highlighted.

Avoid making users search through the interface to find the main actions.

Use consistent navigation across the application.

---

# Prompt 33 — Final UI Cleanup

Review the complete frontend.

Focus only on important UI problems.

Fix:

- Unnecessary empty space
- Misaligned elements
- Inconsistent card sizes
- Hard-to-read text
- Confusing buttons
- Poor spacing
- Navigation issues
- Mobile/responsive problems

Do not add random new features.

Keep the existing design direction.

The application should feel like one product instead of several unrelated screens.

---

# Prompt 34 — Production Configuration

Prepare the backend for deployment.

The backend should:

- Use the environment-provided port
- Listen on 0.0.0.0
- Use PostgreSQL from the environment
- Use Groq API key from environment variables
- Use the configured CORS origin
- Initialize the database schema correctly

Do not put API keys or passwords inside the source code.

Use `.env.example` for example values.

---

# Prompt 35 — Final Security Cleanup

Before committing the project:

Check for:

- `.env` files
- API keys
- passwords
- tokens
- local debug files
- temporary scripts
- scratch folders
- generated build files
- unnecessary test files

Make sure secrets are not tracked by Git.

Keep `.env.example` with placeholder values only.

Do not remove tests that are part of the actual project.

---

# Prompt 36 — Final Code Cleanup

Do one final cleanup before deployment.

Remove:

- unused imports
- unused variables
- temporary console logs
- old debug code
- unused components
- temporary files

Do not rewrite working code just for the sake of changing it.

Run the backend and frontend build after cleanup.

Only fix important errors.

---

# Prompt 37 — Final Production Check

Before deployment, check the main application flow:

```text
Create Agent
    ↓
Start Agent
    ↓
Discover Topics
    ↓
Evaluate Topics
    ↓
Select Topic
    ↓
Generate Content
    ↓
Validate Content
    ↓
Publish
    ↓
Update Memory
    ↓
Activity Log
    ↓
Next Cycle
```

Make sure each important step works with the actual backend.

Do not add fake data just to make the demo look complete.

---

# Final Autonomous Flow

The final system works like this:

```text
Agent Persona
      ↓
Find New Topics
      ↓
Check Previous Topics
      ↓
Score Candidates
      ↓
Select Topic
      ↓
Groq
      ↓
Blog + LinkedIn + X
      ↓
Validate Content
      ↓
Publish
      ↓
Save Memory
      ↓
Activity Log
      ↓
Wait 15 Minutes
      ↓
Start Next Cycle
```
