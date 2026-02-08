# The Sovereign SDLC Platform

**A governance-first development environment for the Agentic Age.**

This platform implements **Spec-Driven Development (SDD)** and **ISO/IEC 42001** compliance by design. It ensures that while AI agents act as the **Responsible** workforce, humans remain strictly **Accountable** for all critical decisions.

## Core Features

- **Constitution-as-Code**: Immutable "Iron Rules" enforced at the database level.
- **RACI Governance Matrix**: Strict separation of AI execution (R) and Human accountability (A).
- **Moral Crumple Zones**: UI patterns designed to prevent "blind approval" and enforce cognitive engagement.
- **ATDI Quality Gate**: (Coming Soon) Automated technical debt calculation to block bad architecture before it ships.

## Project Structure

- `docs/architecture/`: The Single Source of Truth (`spec.md`, `plan.md`, `roadmap.md`).
- `.ai/knowledge_base/`: Academic references for AI Agents (ISO 42001, ATDI, etc.).
- `src/components/governance/`: The "Gatekeeper" UI components.
- `supabase/migrations/`: Database schema with governance triggers.

## Getting Started

1. **Install Dependencies**: `npm install`
2. **Start Dev Server**: `npm run dev`
3. **Verify Governance**: Navigate to `/governance` to see the RACI Dashboard in action.


Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
