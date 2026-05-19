"use client";

export default function GlobalError({}: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html>
      <body>
        <div className="bg-background flex h-screen w-full items-center justify-center">
          <div className="mx-auto max-w-screen-sm text-center">
            <h1 className="text-primary-600 dark:text-primary-500 mb-4 text-7xl font-extrabold tracking-tight lg:text-9xl">
              500
            </h1>
            <p className="mb-4 text-3xl font-bold tracking-tight text-gray-900 md:text-4xl dark:text-white">
              Internal Server Error.
            </p>
            <p className="mb-4 text-lg font-light text-gray-500 dark:text-gray-400">
              We are already working to solve the problem.{" "}
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}
