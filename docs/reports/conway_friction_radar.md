# 📡 Conway Friction Radar
**Generated:** 2026-02-08T09:14:22.813Z

## 1. High Friction Zones (Cognitive Dissonance)
Files where multiple authors are competing for dominance (Friction > 0.5).

| File | Top Author | Friction Score | Contributors |
|---|---|---|---|
| `App.tsx` | **Manuel Ramirez** | 🔴 0.6 | Manuel Ramirez, gpt-engineer-app[bot], Lovable |
| `components/AppNavbar.tsx` | **Manuel Ramirez** | 🔴 0.5 | Manuel Ramirez, gpt-engineer-app[bot] |
| `components/governance/OrgDebtHeatmap.tsx` | **Manu** | 🔴 0.5 | Manu, Manuel Ramirez |
| `index.css` | **gpt-engineer-app[bot]** | 🔴 0.5 | gpt-engineer-app[bot], Lovable |
| `pages/Index.tsx` | **gpt-engineer-app[bot]** | 🔴 0.5 | gpt-engineer-app[bot], Lovable |
| `pages/MissionControl.tsx` | **Manu** | 🔴 0.5 | Manu, Manuel Ramirez |

## 2. Socio-Technical Boundaries (Team Crossing)
Where code dependencies cross "Author Boundaries" (Conway's Law risk).

| Consumer (File) | Owner | --> | Provider (Dep) | Owner |
|---|---|---|---|---|
| `App.tsx` | Manuel Ramirez | --> | `pages/AdminPage.tsx` | gpt-engineer-app[bot] |
| `App.tsx` | Manuel Ramirez | --> | `pages/AuthPage.tsx` | gpt-engineer-app[bot] |
| `App.tsx` | Manuel Ramirez | --> | `pages/ConstitutionPage.tsx` | gpt-engineer-app[bot] |
| `App.tsx` | Manuel Ramirez | --> | `pages/DecisionsPage.tsx` | gpt-engineer-app[bot] |
| `App.tsx` | Manuel Ramirez | --> | `pages/Index.tsx` | gpt-engineer-app[bot] |
| `App.tsx` | Manuel Ramirez | --> | `pages/MissionControl.tsx` | Manu |
| `App.tsx` | Manuel Ramirez | --> | `pages/NotFound.tsx` | Lovable |
| `App.tsx` | Manuel Ramirez | --> | `pages/PipelinePage.tsx` | gpt-engineer-app[bot] |
| `App.tsx` | Manuel Ramirez | --> | `pages/ProjectsPage.tsx` | gpt-engineer-app[bot] |
| `main.tsx` | Lovable | --> | `App.tsx` | Manuel Ramirez |
| `main.tsx` | Lovable | --> | `index.css` | gpt-engineer-app[bot] |
| `pages/Governance.tsx` | Manuel Ramirez | --> | `components/governance/RaciCard/index.tsx` | Manu |
| `pages/MissionControl.tsx` | Manu | --> | `../.ai/knowledge_base/adr_summary.json` | Manuel Ramirez |
| `pages/MissionControl.tsx` | Manu | --> | `components/mission_control/ConeWidget.tsx` | Manuel Ramirez |
| `pages/MissionControl.tsx` | Manu | --> | `components/mission_control/HealthMonitor.tsx` | Manuel Ramirez |
| `pages/MissionControl.tsx` | Manu | --> | `components/mission_control/TimelineFeed.tsx` | Manuel Ramirez |
