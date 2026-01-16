# CyberAware: Project Theme & Architecture

## 🦊 Project Overview & Theme
**CyberAware** (codenamed **RedFox**) is a modern cybersecurity training platform designed to deliver and manage SCORM-compliant security courses. The project’s visual identity is inspired by the **rare Ethiopian fox**, reflecting agility, alertness, and a unique presence in the digital landscape.

### Design Principles
- **Modern & Tech-Forward**: A sleek, dark-themed interface that feels professional yet accessible.
- **High Contrast**: Strategic use of vibrant brand colors against a deep background for clear visual hierarchy.
- **Minimalist Layout**: Focus on readability and task-oriented navigation to minimize user fatigue during training.
- **Responsive & Accessible**: Built to be fully functional across devices, ensuring every employee can access their training.

---

## 🏗️ Technical Architecture
The project follows a modern web stack designed for performance, scalability, and developer productivity.

- **Framework**: [Next.js 15 (App Router)](https://nextjs.org/) for server-side rendering, routing, and API handling.
- **Language**: [TypeScript](https://www.typescriptlang.org/) for type-safe development.
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) for utility-first styling and [Shadcn UI](https://ui.shadcn.com/) for accessible, reusable components.
- **Backend/AI**: 
  - **Firebase**: Used for data storage and potential authentication.
  - **Google Genkit**: Integrated for AI-powered features (metadata extraction, etc.).
- **GoPhish Integration**: Automated remediation course assignment via webhooks.

---

## 📂 File & Folder Structure

```text
CyberAware/
├── .idx/                   # Project-specific configuration for IDX editor
├── docs/                   # Project documentation (blueprints, guides)
├── public/                 # Static assets (images, fonts, icons)
├── src/                    # Main source code
│   ├── ai/                 # AI-related logic, Genkit tools, and dev scripts
│   │   ├── dev.ts          # Genkit development server configuration
│   │   └── genkit.ts       # Core Genkit instance and AI model setup
│   ├── app/                # Next.js App Router (pages, layouts, APIs)
│   │   ├── (admin)/        # Protected admin route group (Dashboard, Courses, Users)
│   │   ├── api/            # Serverless API routes (Webhooks, Integrations)
│   │   ├── learn/          # Student-facing course player interface
│   │   ├── certificate/    # PDF certificate generation and display
│   │   └── layout.tsx      # Root layout with global providers
│   ├── components/         # React components
│   │   ├── app/            # Feature-specific components (Sidebar, Dashboard cards)
│   │   └── ui/             # Reusable Shadcn UI base components
│   ├── hooks/              # Custom React hooks (use-toast, use-mobile)
│   ├── lib/                # Shared utilities, types, and data fetching
│   └── styles/             # Global CSS and Tailwind directives
├── tailwind.config.ts      # Tailwind CSS theme configuration
└── package.json            # Project dependencies and scripts
```

---

## 🎨 Design System & Styling

### Color Palette
The theme uses a sophisticated dark-mode palette defined in `globals.css`:

- **Primary (Fox Red)**: `hsl(16 100% 50%)` (#FF4500) — Used for primary actions, branding, and emphasis.
- **Accent (Yellow)**: `hsl(52 100% 73%)` (#FFE973) — Used for highlights and subtle contrast.
- **Background**: `hsl(222 17% 9%)` (#121317) — A deep grayish blue for a modern, sleek look.
- **Card/Surface**: `hsl(220 21% 5%)` (#0B0C10) — Slightly lighter than the background to create depth.

### Typography
- **Headlines**: `Space Grotesk` — A geometric sans-serif that provides a techy, futuristic feel.
- **Body**: `Inter` — A highly legible sans-serif for optimal reading of training materials.

### Layout & Spacing
- **Sidebar Layout**: Admins use a structured sidebar for navigation (`AppSidebar`).
- **Standard Spacing**: 4px/8px based grid system (e.g., `p-4`, `p-6`).
- **Responsive Design**: Mobile-first approach with breakpoints at `lg` for sidebar desktop views.

---

## 🧩 Component Breakdown

### Core Application Components (`src/components/app/`)
- **`AppSidebar.tsx`**: The main navigation hub for administrators, providing quick access to courses, users, and settings.
- **`Header.tsx`**: Contains page-level actions, search, and user profile information.
- **`CourseTable.tsx`**: A robust data table for managing SCORM packages with status indicators and actions.
- **`StatsCards.tsx`**: Visual dashboard summaries showing enrollment counts and completion rates.
- **`CertificateDisplay.tsx`**: Handles the visual presentation of earned certificates.

### Reusable UI Components (`src/components/ui/`)
Built using **Shadcn UI** (Radix UI + Tailwind), these components ensure consistency:
- **Buttons**: Variant-based (default, destructive, outline) for different intent.
- **Cards**: Container for grouping related content (e.g., dashboard stats).
- **Dialog/Sheet**: Used for overlays like uploading courses or editing user details.
- **Forms**: Built with `react-hook-form` and `zod` for robust validation.

---

## 🔄 Reusable Patterns
- **Utility-First Styling**: Almost all styling is handled via Tailwind classes to avoid CSS bloat.
- **Data Fetching**: Centralized in `src/lib/data.ts` for clean abstraction from components.
- **State Management**: React state and hooks are used for UI logic; larger state is handled via Next.js URL parameters or server-side data.
- **Metadata Management**: SCORM data and course metadata are managed through typed interfaces in `src/lib/types.ts`.

