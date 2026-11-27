import { Header } from "@/components/public/header";
import { SubmissionForm } from "@/components/public/submission-form";
import { Footer } from "@/components/public/footer";

export default function HomePage() {
  return (
    <div className="min-h-dvh flex flex-col bg-[#FFFFFF]">
      <Header />

      {/* Main Container - Mobile-first single column (320px up to 500px max on desktop) */}
      <main className="flex-1 flex flex-col justify-center items-center px-3.5 sm:px-6 py-8 sm:py-16 w-full">
        <div className="w-full max-w-[500px] flex flex-col">
          {/* Editorial Heading */}
          <div className="mb-6 sm:mb-8 text-center sm:text-left">
            <h1 className="text-2xl sm:text-4xl font-semibold tracking-tight text-[#171717] mb-1.5 sm:mb-2">
              Say what&apos;s on your mind.
            </h1>
            <p className="text-sm sm:text-base text-[#737373] tracking-tight">
              No names. Just words.
            </p>
          </div>

          {/* Submission Form */}
          <SubmissionForm />
        </div>
      </main>

      <Footer />
    </div>
  );
}
