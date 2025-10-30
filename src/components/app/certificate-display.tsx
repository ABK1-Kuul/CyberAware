import type { Certificate, Enrollment } from "@/lib/types"
import { format } from 'date-fns'
import Image from "next/image"

const ShieldIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
  </svg>
)

export function CertificateDisplay({ enrollment, certificate }: { enrollment: Enrollment, certificate: Certificate }) {
  const issueDate = format(new Date(certificate.issuedAt), "MMMM d, yyyy")

  return (
    <div className="aspect-[11/8.5] w-full bg-card border-4 border-primary shadow-2xl p-8 flex flex-col relative overflow-hidden">
        <Image 
            src="https://picsum.photos/seed/certbg/1100/850"
            alt="Certificate background"
            layout="fill"
            objectFit="cover"
            className="absolute inset-0 opacity-5"
            data-ai-hint="abstract geometric"
        />
        <div className="relative z-10 flex flex-col h-full">
            <header className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                    <ShieldIcon className="w-12 h-12 text-primary" />
                    <div>
                        <h1 className="text-3xl font-bold font-headline text-foreground">RedFox</h1>
                        <p className="text-sm text-muted-foreground">Corporate Security Training</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-sm font-semibold text-accent">Certificate of Completion</p>
                    <p className="text-xs text-muted-foreground mt-1">ID: {certificate.uuid.slice(0, 13)}</p>
                </div>
            </header>

            <main className="flex-grow flex flex-col items-center justify-center text-center -mt-8">
                <p className="text-lg text-muted-foreground mb-2">This certifies that</p>
                <h2 className="text-5xl font-bold font-headline text-primary mb-4">{enrollment.user.name}</h2>
                <p className="text-lg text-muted-foreground">has successfully completed the course</p>
                <h3 className="text-3xl font-semibold font-headline text-accent mt-2">{enrollment.course.title}</h3>
            </main>

            <footer className="flex justify-between items-end">
                <div className="text-left">
                    <p className="text-sm font-semibold border-t border-muted-foreground pt-1 w-48 text-center">{issueDate}</p>
                    <p className="text-xs text-muted-foreground mt-1 text-center">Date Issued</p>
                </div>
                <div className="text-right">
                    <p className="text-sm font-semibold border-t border-muted-foreground pt-1 w-48 text-center">Authorized Signature</p>
                    <p className="text-xs text-muted-foreground mt-1 text-center">Head of Security</p>
                </div>
            </footer>
        </div>
    </div>
  )
}
