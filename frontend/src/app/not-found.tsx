import Link from "next/link";

export default async function NotFound() {
  return (
    <div className="bg-background flex h-screen w-full items-center justify-center">
      <div className="mx-auto max-w-screen-sm text-center">
        <h1 className="text-primary-600 dark:text-primary-500 mb-4 text-7xl font-extrabold tracking-tight lg:text-9xl">
          404
        </h1>
        <p className="mb-4 text-3xl font-bold tracking-tight text-gray-900 md:text-4xl dark:text-white">
          Something&apos;s missing.
        </p>
        <p className="mb-4 text-lg font-light text-gray-500 dark:text-gray-400">
          Sorry, we can&apos;t find that page. You&apos;ll find lots to explore on the home
          page.{" "}
        </p>
        <Link
          href="/"
          className="bg-primary-600 hover:bg-primary-800 my-4 inline-flex rounded-lg px-5 py-2.5 text-center text-sm font-medium text-white focus:outline-none"
        >
          Back to Homepage
        </Link>
      </div>
    </div>
  );
}
