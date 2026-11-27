import { Header } from "@/components/public/header";
import { SubmissionForm } from "@/components/public/submission-form";
import { Footer } from "@/components/public/footer";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#FFFFFF]">
      <Header />

      {/* Main Container - Centered Single Column with 480-520px Max Form Width */}
      <main className="flex-1 flex flex-col justify-center items-center px-4 sm:px-6 py-12 sm:py-16">
        <div className="w-full max-w-[500px] flex flex-col">
          {/* Editorial Heading */}
          <div className="mb-8 text-center sm:text-left">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#171717] mb-2">
              Say what&apos;s on your mind.
            </h1>
            <p className="text-base text-[#737373] tracking-tight">
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
