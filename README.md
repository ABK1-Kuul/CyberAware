# 🦊 CyberAware (RedFox)

> A modern, enterprise-grade cybersecurity training platform designed to deliver SCORM-compliant security courses with intelligent automation and comprehensive progress tracking.

[![Next.js](https://img.shields.io/badge/Next.js-15.3-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-2D3748)](https://www.prisma.io/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1)](https://www.mysql.com/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## 📋 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [What CyberAware Can Achieve](#what-cyberaware-can-achieve)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Development](#development)
- [Roadmap](#roadmap)
- [Contributing](#contributing)

---

## 🎯 Overview

**CyberAware** (codenamed **RedFox**) is a comprehensive Learning Management System (LMS) specifically designed for cybersecurity training. Inspired by the rare Ethiopian fox, the platform embodies agility, alertness, and a unique presence in the digital security landscape.

The platform enables organizations to:
- **Deliver** SCORM-compliant cybersecurity training courses
- **Track** employee progress and completion rates
- **Automate** course assignments based on security events
- **Generate** professional completion certificates
- **Integrate** with existing security tools (GoPhish, etc.)
- **Monitor** training effectiveness through comprehensive dashboards

### Design Philosophy

CyberAware features a modern, dark-themed interface that prioritizes:
- **Professional Aesthetics**: Sleek design that feels enterprise-ready
- **High Contrast**: Strategic use of vibrant brand colors for clear visual hierarchy
- **Minimalist Layout**: Focus on readability and task-oriented navigation
- **Responsive Design**: Fully functional across all devices

---

## ✨ Key Features

### 🎓 Course Management
- **SCORM Package Upload**: Upload and validate SCORM 1.2 and 2004 packages
- **AI-Powered Metadata Extraction**: Automatically extract course information using Google Genkit
- **Course Versioning**: Track and manage multiple versions of courses
- **Bulk Operations**: Manage multiple courses efficiently

### 👥 User & Enrollment Management
- **Role-Based Access Control**: Admin and Learner roles with appropriate permissions
- **Manual Assignment**: Assign courses to individual users or groups
- **Automated Assignment**: Trigger course assignments via webhooks
- **Progress Tracking**: Real-time progress monitoring with resume capability
- **Group Management**: Organize users into teams for streamlined assignment

### 🔗 Integrations
- **GoPhish Integration**: Automatically assign remediation courses when users fail phishing tests
- **Webhook Support**: Flexible webhook system for external tool integration
- **Email Notifications**: Automated email system for course assignments and completions
- **Future Integrations**: LDAP/AD sync, Slack/Teams notifications, HRIS integration

### 📊 Analytics & Reporting
- **Admin Dashboard**: Comprehensive overview of training metrics
- **Completion Analytics**: Track completion rates over time
- **User Progress Reports**: Detailed progress tracking per user
- **Activity Logs**: Audit trail of all system actions
- **Export Capabilities**: Export data for external analysis

### 🏆 Certificates & Completion
- **Automatic Certificate Generation**: PDF certificates generated upon course completion
- **Branded Certificates**: Customizable certificates with company branding
- **Certificate Verification**: Public verification system for certificate authenticity
- **Digital Badges**: Shareable completion credentials

### 🎮 SCORM Player
- **Full SCORM Support**: Compatible with SCORM 1.2 and 2004 standards
- **Progress Persistence**: Save and resume course progress
- **Real-time Tracking**: Live progress updates and status synchronization
- **Mobile Responsive**: Works seamlessly on all devices

---

## 🚀 What CyberAware Can Achieve

### For Organizations

#### 📈 Improved Security Posture
- **Measurable Training Impact**: Track which employees complete training and identify knowledge gaps
- **Automated Remediation**: Instantly assign training when security incidents occur
- **Compliance Tracking**: Maintain records of completed training for audits and compliance
- **Risk Reduction**: Proactively address security vulnerabilities through targeted training

#### 💼 Operational Efficiency
- **Streamlined Workflows**: Automate course assignments based on events or schedules
- **Centralized Management**: Single platform for all cybersecurity training needs
- **Time Savings**: Reduce manual course assignment and tracking overhead
- **Scalability**: Handle training for organizations of any size

#### 📊 Data-Driven Insights
- **Training Analytics**: Understand training effectiveness through comprehensive metrics
- **Completion Trends**: Identify patterns in training completion and engagement
- **Performance Tracking**: Monitor individual and team progress over time
- **ROI Measurement**: Quantify the impact of security training investments

### For Administrators

#### 🎛️ Complete Control
- **Course Library Management**: Upload, organize, and manage SCORM packages
- **User Management**: Add, remove, and organize learners into groups
- **Assignment Flexibility**: Manual or automated course assignments
- **Customization**: Brand certificates and customize email templates

#### 📈 Visibility & Monitoring
- **Real-time Dashboards**: Monitor training progress at a glance
- **Detailed Reports**: Generate comprehensive reports on training activities
- **Audit Trails**: Track all system actions for compliance and troubleshooting
- **Alert System**: Get notified of important events and milestones

### For Learners

#### 🎯 Seamless Learning Experience
- **Easy Access**: Launch courses directly from email links
- **Progress Tracking**: See your progress and completion status
- **Resume Capability**: Pick up where you left off without losing progress
- **Mobile Learning**: Access training from any device, anywhere

#### 🏅 Recognition & Achievement
- **Certificates**: Receive professional certificates upon completion
- **Verification**: Share verifiable completion credentials
- **Progress Visibility**: Track your learning journey across all courses
- **Achievement System**: Earn badges and recognition for completed training

---

## 🛠️ Technology Stack

### Frontend
- **Framework**: [Next.js 15](https://nextjs.org/) with App Router
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) + [Shadcn UI](https://ui.shadcn.com/)
- **Forms**: [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/)
- **Charts**: [Recharts](https://recharts.org/)
- **Icons**: [Lucide React](https://lucide.dev/)

### Backend & Services
- **Database**: [MySQL](https://www.mysql.com/) 8.0+ with [Prisma ORM](https://www.prisma.io/)
- **ORM**: Prisma 5.22.0 for type-safe database access
- **Storage**: File storage solution (to be implemented - S3/Cloudinary/local)
- **Authentication**: To be implemented (NextAuth.js, Clerk, or custom)
- **AI/ML**: [Google Genkit](https://firebase.google.com/docs/genkit) with Gemini 2.5 Flash
- **API**: Next.js API Routes (Serverless Functions)

### Development Tools
- **Package Manager**: npm
- **Build Tool**: Next.js Turbopack
- **Linting**: ESLint
- **Type Checking**: TypeScript

---

## 🏗️ Architecture

### Application Structure

```
CyberAware/
├── .idx/                       # IDX editor configuration
├── docs/                       # Project documentation
│   ├── blueprint.md            # Core feature specifications
│   └── IMPROVEMENTS_AND_MILESTONES.md  # Development roadmap
├── prisma/                     # Database schema and migrations
│   ├── schema.prisma           # Prisma schema (MySQL)
│   ├── seed.sql                # SQL dump with initial data
│   ├── MIGRATION_GUIDE.md      # Database setup guide
│   └── README.md               # Prisma documentation
├── src/
│   ├── ai/                     # AI/Genkit integration
│   │   ├── dev.ts              # Genkit dev server config
│   │   └── genkit.ts           # Genkit instance setup
│   ├── app/                    # Next.js App Router
│   │   ├── (admin)/            # Protected admin routes
│   │   │   ├── dashboard/      # Analytics dashboard
│   │   │   ├── courses/       # Course management
│   │   │   ├── users/          # User management
│   │   │   ├── settings/       # System settings
│   │   │   └── layout.tsx      # Admin layout with sidebar
│   │   ├── api/                # API routes
│   │   │   └── integrations/   # External integrations
│   │   │       └── gophish/
│   │   │           └── webhook/
│   │   │               └── route.ts  # GoPhish webhook handler
│   │   ├── learn/              # Course player
│   │   │   └── [enrollmentId]/
│   │   │       └── page.tsx
│   │   ├── certificate/        # Certificate display
│   │   │   └── [certificateId]/
│   │   │       └── page.tsx
│   │   ├── globals.css          # Global styles & theme
│   │   ├── layout.tsx          # Root layout
│   │   └── page.tsx            # Landing/login page
│   ├── components/
│   │   ├── app/                # Feature-specific components
│   │   │   ├── app-sidebar.tsx
│   │   │   ├── certificate-display.tsx
│   │   │   ├── courses/
│   │   │   │   ├── course-table.tsx
│   │   │   │   └── upload-course-dialog.tsx
│   │   │   ├── dashboard/
│   │   │   │   ├── completion-chart.tsx
│   │   │   │   ├── recent-activity-table.tsx
│   │   │   │   └── stats-cards.tsx
│   │   │   └── header.tsx
│   │   └── ui/                 # Shadcn UI components (30+)
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── dialog.tsx
│   │       ├── form.tsx
│   │       ├── table.tsx
│   │       └── ... (25+ more UI components)
│   ├── hooks/                  # Custom React hooks
│   │   ├── use-mobile.tsx
│   │   └── use-toast.ts
│   └── lib/                    # Shared utilities
│       ├── data.ts             # Data access layer (Prisma)
│       ├── prisma.ts           # Prisma client singleton
│       ├── types.ts            # TypeScript type definitions
│       ├── utils.ts            # Utility functions
│       └── placeholder-images.ts
├── .gitignore
├── components.json             # Shadcn UI configuration
├── MIGRATION_SUMMARY.md        # Firebase→MySQL migration summary
├── next.config.ts              # Next.js configuration
├── package.json                # Dependencies & scripts
├── tailwind.config.ts          # Tailwind CSS configuration
├── THEME_AND_ARCHITECTURE_follow.md  # Architecture documentation
└── tsconfig.json               # TypeScript configuration
```

### Design System

- **Primary Color**: Fox Red (#FF4500) - `hsl(16 100% 50%)`
- **Accent Color**: Light Yellow (#FFE973) - `hsl(52 100% 73%)`
- **Background**: Dark Grayish Blue (#121317) - `hsl(222 17% 9%)`
- **Headline Font**: Space Grotesk
- **Body Font**: Inter

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ and npm
- **MySQL** 8.0+ (local or remote database)
- **Git** (for version control)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/ABK1-Kuul/CyberAware.git
   cd CyberAware
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```env
   # Database
   DATABASE_URL="mysql://user:password@localhost:3306/cyberaware"

   # Google Genkit (AI)
   GOOGLE_GENAI_API_KEY=your_genai_key

   # GoPhish Integration
   GOPHISH_WEBHOOK_SECRET=your_webhook_secret

   # Next.js
   NODE_ENV=development
   ```

4. **Set up the database**
   ```bash
   # Create MySQL database
   mysql -u root -p
   CREATE DATABASE cyberaware CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   EXIT;

   # Generate Prisma Client
   npm run db:generate

   # Run migrations
   npm run db:migrate

   # Import seed data (optional)
   mysql -u your_user -p cyberaware < prisma/seed.sql
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:9002](http://localhost:9002)

### Additional Development Commands

```bash
# Database commands
npm run db:generate    # Generate Prisma Client
npm run db:push        # Push schema changes to database
npm run db:migrate     # Create and apply migrations
npm run db:studio      # Open Prisma Studio (database GUI)

# AI/Genkit commands
npm run genkit:dev     # Start Genkit AI development server
npm run genkit:watch   # Start Genkit with watch mode

# Development commands
npm run dev            # Start development server
npm run build          # Build for production
npm start              # Start production server
npm run typecheck      # Run TypeScript type checking
npm run lint           # Run ESLint
```

---

## 📁 Project Structure

### Key Directories

- **`src/app/`**: Next.js pages and API routes (App Router)
- **`src/components/app/`**: Feature-specific React components
- **`src/components/ui/`**: Reusable Shadcn UI components (30+)
- **`src/lib/`**: Utility functions, data access layer (Prisma), and type definitions
- **`src/hooks/`**: Custom React hooks
- **`src/ai/`**: AI/Genkit configuration and tools
- **`prisma/`**: Database schema, migrations, and seed data
- **`docs/`**: Project documentation

### Important Files

- **`prisma/schema.prisma`**: Prisma database schema (MySQL)
- **`prisma/seed.sql`**: SQL dump with initial seed data
- **`src/lib/prisma.ts`**: Prisma client singleton
- **`src/lib/data.ts`**: Data access layer using Prisma
- **`THEME_AND_ARCHITECTURE_follow.md`**: Design system and architecture guidelines
- **`docs/IMPROVEMENTS_AND_MILESTONES.md`**: Comprehensive development roadmap
- **`docs/blueprint.md`**: Core feature specifications
- **`MIGRATION_SUMMARY.md`**: Firebase to MySQL migration documentation
- **`tailwind.config.ts`**: Tailwind CSS configuration
- **`next.config.ts`**: Next.js configuration

---

## 💻 Development

### Development Workflow

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow the architecture guidelines in `THEME_AND_ARCHITECTURE_follow.md`
   - Write TypeScript with proper types
   - Use Tailwind CSS for styling
   - Follow the existing component patterns

3. **Test your changes**
   - Run type checking: `npm run typecheck`
   - Test in development: `npm run dev`
   - Verify UI components render correctly

4. **Commit and push**
   ```bash
   git add .
   git commit -m "feat: description of your changes"
   git push origin feature/your-feature-name
   ```

### Code Style

- **TypeScript**: Strict mode enabled
- **Components**: Functional components with TypeScript
- **Styling**: Tailwind CSS utility classes
- **Naming**: PascalCase for components, camelCase for functions
- **File Structure**: Co-locate related files when possible

### Current Status

The project is currently in **active development**. 

**✅ Completed:**
- Complete UI/UX foundation with dark theme
- Full Shadcn UI component library (30+ components)
- Database layer migrated to MySQL with Prisma ORM
- All data access functions using Prisma queries
- Database schema with 6 models, relationships, and indexes
- Seed data SQL dump available

**🔄 In Progress:**
- Authentication system
- SCORM processing and upload
- Course player implementation
- Certificate generation

See `docs/IMPROVEMENTS_AND_MILESTONES.md` for the complete development roadmap.

---

## 🗺️ Roadmap

CyberAware follows an 8-milestone development plan:

1. 🔄 **Foundation & Authentication** - Authentication setup, user management
2. ✅ **Data Layer & Storage** - MySQL/Prisma integration completed
3. 🔄 **SCORM Processing & Upload** - Package validation, metadata extraction
4. 🔄 **Course Player & Runtime** - SCORM player, progress tracking
5. 🔄 **Enrollment & Assignment** - Manual/automated assignments, email system
6. 🔄 **Certificates & Completion** - PDF generation, completion workflows
7. 🔄 **Integrations & Automation** - GoPhish webhook, automation rules
8. 🔄 **Polish & Production** - Testing, monitoring, optimization

**Note:** The database layer has been migrated from Firebase to MySQL with Prisma ORM. All data access functions are now using Prisma queries.

For detailed task breakdowns and timelines, see [docs/IMPROVEMENTS_AND_MILESTONES.md](docs/IMPROVEMENTS_AND_MILESTONES.md).

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Follow the code style** and architecture guidelines
4. **Test your changes** thoroughly
5. **Commit your changes** (`git commit -m 'feat: Add amazing feature'`)
6. **Push to the branch** (`git push origin feature/amazing-feature`)
7. **Open a Pull Request**

### Contribution Areas

- Bug fixes and improvements
- New features aligned with the roadmap
- Documentation improvements
- UI/UX enhancements
- Performance optimizations
- Test coverage improvements

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 📞 Support & Contact

For questions, issues, or contributions:

- **GitHub Issues**: [Open an issue](https://github.com/ABK1-Kuul/CyberAware/issues)
- **Documentation**: See the `docs/` directory for detailed documentation

---

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- UI components from [Shadcn UI](https://ui.shadcn.com/)
- Database powered by [MySQL](https://www.mysql.com/) and [Prisma](https://www.prisma.io/)
- AI capabilities via [Google Genkit](https://firebase.google.com/docs/genkit)
- Styling with [Tailwind CSS](https://tailwindcss.com/)

---

<div align="center">

**Made with 🦊 by the CyberAware Team**

*Empowering organizations to build stronger cybersecurity awareness*

</div>
