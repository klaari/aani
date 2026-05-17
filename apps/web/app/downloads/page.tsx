"use client";

import { useState } from "react";
import type { DownloadJob } from "@aani/types";
import DownloadForm from "@/components/DownloadForm";
import DownloadList from "@/components/DownloadList";
import { Surface, Text, VStack } from "@/components/ui";

export default function DownloadsPage() {
  const [jobs, setJobs] = useState<DownloadJob[]>([]);

  const jobCount = jobs.length;
  const jobCountLabel = jobCount === 1 ? "1 job" : `${jobCount} jobs`;

  return (
    <VStack gap="lg" pad="lg" className="max-w-3xl w-full mx-auto">
      <VStack gap="xs">
        <Text variant="eyebrow" tone="muted">
          Queue
        </Text>
        <Text variant="titleLg">
          {jobCount > 0 ? jobCountLabel : "Downloads"}
        </Text>
      </VStack>

      <Surface tone="raised" rounded="xl" pad="sm" bordered>
        <DownloadForm
          onJobCreated={(job) => setJobs((prev) => [job, ...prev])}
        />
      </Surface>

      <DownloadList jobs={jobs} setJobs={setJobs} />
    </VStack>
  );
}
