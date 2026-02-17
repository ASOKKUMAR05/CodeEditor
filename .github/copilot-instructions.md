# Copilot Instructions for CodeEditor (React + Vite)

## Project Overview
- **Framework:** React (JSX) with Vite for fast development and HMR.
- **Structure:**
  - `src/components/`: Reusable UI components (e.g., `Editor.jsx`, `Sidebar.jsx`, `Chat.jsx`).
  - `src/pages/`: Page-level components (main app logic in `App.js`).
  - `src/utlis/`: Utility modules for real-time collaboration (`socket.js`, `yjs.js`).
  - `public/`: Static assets.
  - `vite.config.js`: Vite build configuration.
  - `eslint.config.js`: ESLint rules (JS only, not TypeScript).

## Key Patterns & Conventions
- **Component Communication:**
  - Props and context are used for data flow between components.
  - Real-time features (e.g., collaborative editing) use WebSocket (`socket.js`) and Yjs CRDT (`yjs.js`).
- **Styling:**
  - CSS modules (`App.css`, `index.css`) for scoped styles.
- **Utilities:**
  - All utility code is in `src/utlis/` (note: typo in folder name, should be `utils`).
- **File Naming:**
  - Components use PascalCase, pages use camelCase or PascalCase.

## Developer Workflows
- **Start Dev Server:**
  - Run `npm install` in `my-app/`.
  - Run `npm run dev` to start Vite server (hot reload enabled).
- **Build:**
  - Run `npm run build` for production build.
- **Lint:**
  - Run `npm run lint` (uses config in `eslint.config.js`).
- **No formal test setup detected.**

## Integration Points
- **WebSocket:**
  - `src/utlis/socket.js` manages socket connections for collaborative features.
- **Yjs:**
  - `src/utlis/yjs.js` handles CRDT-based document sync.
- **Vite Plugins:**
  - Uses `@vitejs/plugin-react` or `@vitejs/plugin-react-swc` for Fast Refresh.


## Special Notes

## Examples
- To add a new UI feature, create a component in `src/components/` and import it in `Layout.jsx` or `Sidebar.jsx`.
- For real-time sync, use the socket and Yjs utilities as in `Editor.jsx`.

## UI Visibility Note
- In `Layout.jsx`, the `Editor` component hides other components when active. This affects which features are visible in the UI and is important for understanding user experience and component integration.

## Special Notes
- The `src/utlis/` folder is a typo; consider renaming to `utils` for consistency.
- No TypeScript or test framework is present; code is plain JS/JSX.

---

**For AI agents:**
- Follow the above structure and patterns for new features.
- Reference `Editor.jsx`, `socket.js`, and `yjs.js` for collaborative logic.
- Use Vite and ESLint commands for builds and linting.
- Ask for clarification if you encounter ambiguous patterns or missing documentation.
