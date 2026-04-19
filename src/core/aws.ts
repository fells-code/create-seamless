import { execCommand } from "./exec.js";

export interface AwsIdentity {
  accountId: string;
  arn: string;
  userId: string;
}

export interface HostedZoneSummary {
  id: string;
  name: string;
  privateZone: boolean;
}

export interface EcrRepositorySummary {
  repositoryName: string;
  repositoryUri: string;
}

export async function getAwsIdentity(
  profile: string,
  region: string,
): Promise<AwsIdentity> {
  const result = await execCommand(
    "aws",
    [
      "--profile",
      profile,
      "--region",
      region,
      "sts",
      "get-caller-identity",
      "--output",
      "json",
    ],
    { quiet: true },
  );

  const parsed = JSON.parse(result.stdout) as {
    Account: string;
    Arn: string;
    UserId: string;
  };

  return {
    accountId: parsed.Account,
    arn: parsed.Arn,
    userId: parsed.UserId,
  };
}

export async function listHostedZones(
  profile: string,
  region: string,
): Promise<HostedZoneSummary[]> {
  const result = await execCommand(
    "aws",
    [
      "--profile",
      profile,
      "--region",
      region,
      "route53",
      "list-hosted-zones",
      "--output",
      "json",
    ],
    { quiet: true },
  );

  const parsed = JSON.parse(result.stdout) as {
    HostedZones?: Array<{
      Id: string;
      Name: string;
      Config?: {
        PrivateZone?: boolean;
      };
    }>;
  };

  return (parsed.HostedZones ?? [])
    .map((zone) => ({
      id: zone.Id.replace("/hostedzone/", ""),
      name: zone.Name.replace(/\.$/, ""),
      privateZone: Boolean(zone.Config?.PrivateZone),
    }))
    .filter((zone) => !zone.privateZone)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function ensureRoute53ZoneExistsByName(
  profile: string,
  region: string,
  hostedZoneDomain: string,
): Promise<HostedZoneSummary> {
  const zones = await listHostedZones(profile, region);
  const match = zones.find((zone) => zone.name === hostedZoneDomain);

  if (!match) {
    throw new Error(
      `Route 53 hosted zone not found for domain: ${hostedZoneDomain}`,
    );
  }

  return match;
}

export async function getEcrLoginPassword(
  profile: string,
  region: string,
): Promise<string> {
  const result = await execCommand(
    "aws",
    ["--profile", profile, "--region", region, "ecr", "get-login-password"],
    { quiet: true },
  );

  return result.stdout.trim();
}

export function buildEcrRegistry(accountId: string, region: string): string {
  return `${accountId}.dkr.ecr.${region}.amazonaws.com`;
}

export function buildEcrImageUri(
  registry: string,
  repositoryName: string,
  tag: string,
): string {
  return `${registry}/${repositoryName}:${tag}`;
}

export async function describeEcrRepository(
  profile: string,
  region: string,
  repositoryName: string,
): Promise<EcrRepositorySummary | null> {
  try {
    const result = await execCommand(
      "aws",
      [
        "--profile",
        profile,
        "--region",
        region,
        "ecr",
        "describe-repositories",
        "--repository-names",
        repositoryName,
        "--output",
        "json",
      ],
      { quiet: true },
    );

    const parsed = JSON.parse(result.stdout) as {
      repositories?: Array<{
        repositoryName: string;
        repositoryUri: string;
      }>;
    };

    const repo = parsed.repositories?.[0];
    if (!repo) return null;

    return {
      repositoryName: repo.repositoryName,
      repositoryUri: repo.repositoryUri,
    };
  } catch {
    return null;
  }
}

export async function ensureEcrRepository(
  profile: string,
  region: string,
  repositoryName: string,
): Promise<EcrRepositorySummary> {
  const existing = await describeEcrRepository(profile, region, repositoryName);
  if (existing) return existing;

  const result = await execCommand(
    "aws",
    [
      "--profile",
      profile,
      "--region",
      region,
      "ecr",
      "create-repository",
      "--repository-name",
      repositoryName,
      "--image-tag-mutability",
      "MUTABLE",
      "--image-scanning-configuration",
      "scanOnPush=true",
      "--output",
      "json",
    ],
    { quiet: true },
  );

  const parsed = JSON.parse(result.stdout) as {
    repository: {
      repositoryName: string;
      repositoryUri: string;
    };
  };

  return {
    repositoryName: parsed.repository.repositoryName,
    repositoryUri: parsed.repository.repositoryUri,
  };
}

export async function ensureEcrRepositories(
  profile: string,
  region: string,
  repositoryNames: string[],
): Promise<EcrRepositorySummary[]> {
  const repositories: EcrRepositorySummary[] = [];

  for (const repositoryName of repositoryNames) {
    const repository = await ensureEcrRepository(
      profile,
      region,
      repositoryName,
    );
    repositories.push(repository);
  }

  return repositories;
}

export async function listEcrImages(
  profile: string,
  region: string,
  repositoryName: string,
): Promise<string[]> {
  try {
    const result = await execCommand(
      "aws",
      [
        "--profile",
        profile,
        "--region",
        region,
        "ecr",
        "list-images",
        "--repository-name",
        repositoryName,
        "--query",
        "imageIds[*].imageTag",
        "--output",
        "json",
      ],
      { quiet: true },
    );

    const parsed = JSON.parse(result.stdout) as Array<string | null>;
    return parsed.filter((tag): tag is string => Boolean(tag));
  } catch {
    return [];
  }
}

export async function deleteEcrImages(
  profile: string,
  region: string,
  repositoryName: string,
): Promise<void> {
  const result = await execCommand(
    "aws",
    [
      "--profile",
      profile,
      "--region",
      region,
      "ecr",
      "list-images",
      "--repository-name",
      repositoryName,
      "--output",
      "json",
    ],
    { quiet: true },
  );

  const parsed = JSON.parse(result.stdout) as {
    imageIds?: Array<{ imageTag?: string; imageDigest?: string }>;
  };

  const imageIds = parsed.imageIds ?? [];
  if (imageIds.length === 0) return;

  const payload = JSON.stringify({
    imageIds: imageIds.map((image) => {
      if (image.imageDigest) {
        return { imageDigest: image.imageDigest };
      }
      return { imageTag: image.imageTag };
    }),
  });

  await execCommand(
    "aws",
    [
      "--profile",
      profile,
      "--region",
      region,
      "ecr",
      "batch-delete-image",
      "--repository-name",
      repositoryName,
      "--cli-input-json",
      payload,
    ],
    { quiet: true },
  );
}

export async function deleteEcrRepository(
  profile: string,
  region: string,
  repositoryName: string,
): Promise<void> {
  try {
    await execCommand(
      "aws",
      [
        "--profile",
        profile,
        "--region",
        region,
        "ecr",
        "delete-repository",
        "--repository-name",
        repositoryName,
        "--force",
      ],
      { quiet: true },
    );
  } catch {}
}

export async function listAllS3ObjectVersions(
  profile: string,
  region: string,
  bucketName: string,
): Promise<Array<{ Key: string; VersionId: string }>> {
  const result = await execCommand(
    "aws",
    [
      "--profile",
      profile,
      "--region",
      region,
      "s3api",
      "list-object-versions",
      "--bucket",
      bucketName,
      "--output",
      "json",
    ],
    { quiet: true },
  );

  const parsed = JSON.parse(result.stdout) as {
    Versions?: Array<{ Key?: string; VersionId?: string }>;
    DeleteMarkers?: Array<{ Key?: string; VersionId?: string }>;
  };

  const versions = (parsed.Versions ?? [])
    .filter(
      (item): item is { Key: string; VersionId: string } =>
        Boolean(item.Key) && Boolean(item.VersionId),
    )
    .map((item) => ({
      Key: item.Key,
      VersionId: item.VersionId,
    }));

  const deleteMarkers = (parsed.DeleteMarkers ?? [])
    .filter(
      (item): item is { Key: string; VersionId: string } =>
        Boolean(item.Key) && Boolean(item.VersionId),
    )
    .map((item) => ({
      Key: item.Key,
      VersionId: item.VersionId,
    }));

  return [...versions, ...deleteMarkers];
}

export async function deleteS3ObjectVersionsBatch(
  profile: string,
  region: string,
  bucketName: string,
  objects: Array<{ Key: string; VersionId: string }>,
): Promise<void> {
  if (objects.length === 0) return;

  const payload = JSON.stringify({
    Bucket: bucketName,
    Delete: {
      Objects: objects.map((item) => ({
        Key: item.Key,
        VersionId: item.VersionId,
      })),
      Quiet: true,
    },
  });

  await execCommand(
    "aws",
    [
      "--profile",
      profile,
      "--region",
      region,
      "s3api",
      "delete-objects",
      "--cli-input-json",
      payload,
    ],
    { quiet: true },
  );
}

export async function emptyVersionedS3Bucket(
  profile: string,
  region: string,
  bucketName: string,
): Promise<void> {
  while (true) {
    const objects = await listAllS3ObjectVersions(profile, region, bucketName);
    if (objects.length === 0) break;

    const batchSize = 500;
    for (let i = 0; i < objects.length; i += batchSize) {
      const batch = objects.slice(i, i + batchSize);
      await deleteS3ObjectVersionsBatch(profile, region, bucketName, batch);
    }
  }
}

export interface AcmValidationRecord {
  name: string;
  type: string;
  value: string;
}

export async function findExistingAcmCertificate(
  profile: string,
  region: string,
  rootDomain: string,
): Promise<string | null> {
  const result = await execCommand(
    "aws",
    [
      "--profile",
      profile,
      "--region",
      region,
      "acm",
      "list-certificates",
      "--output",
      "json",
    ],
    { quiet: true },
  );

  const parsed = JSON.parse(result.stdout) as {
    CertificateSummaryList?: Array<{
      CertificateArn?: string;
      DomainName?: string;
    }>;
  };

  const match = (parsed.CertificateSummaryList ?? []).find(
    (cert) => cert.DomainName === rootDomain && cert.CertificateArn,
  );

  return match?.CertificateArn ?? null;
}

export async function requestAcmCertificate(
  profile: string,
  region: string,
  rootDomain: string,
  sans: string[],
): Promise<string> {
  const result = await execCommand(
    "aws",
    [
      "--profile",
      profile,
      "--region",
      region,
      "acm",
      "request-certificate",
      "--domain-name",
      rootDomain,
      "--subject-alternative-names",
      ...sans,
      "--validation-method",
      "DNS",
      "--output",
      "json",
    ],
    { quiet: true },
  );

  const parsed = JSON.parse(result.stdout) as { CertificateArn: string };
  return parsed.CertificateArn;
}

export async function describeAcmCertificate(
  profile: string,
  region: string,
  certificateArn: string,
): Promise<{
  status: string;
  validationRecords: AcmValidationRecord[];
}> {
  const result = await execCommand(
    "aws",
    [
      "--profile",
      profile,
      "--region",
      region,
      "acm",
      "describe-certificate",
      "--certificate-arn",
      certificateArn,
      "--output",
      "json",
    ],
    { quiet: true },
  );

  const parsed = JSON.parse(result.stdout) as {
    Certificate?: {
      Status?: string;
      DomainValidationOptions?: Array<{
        ResourceRecord?: {
          Name?: string;
          Type?: string;
          Value?: string;
        };
      }>;
    };
  };

  const validationRecords = (parsed.Certificate?.DomainValidationOptions ?? [])
    .map((option) => option.ResourceRecord)
    .filter(
      (record): record is { Name: string; Type: string; Value: string } =>
        Boolean(record?.Name) &&
        Boolean(record?.Type) &&
        Boolean(record?.Value),
    )
    .map((record) => ({
      name: record.Name,
      type: record.Type,
      value: record.Value,
    }));

  return {
    status: parsed.Certificate?.Status ?? "UNKNOWN",
    validationRecords,
  };
}

export async function upsertRoute53Records(
  profile: string,
  hostedZoneId: string,
  records: AcmValidationRecord[],
): Promise<void> {
  if (records.length === 0) {
    throw new Error("No ACM validation records available yet");
  }

  const payload = JSON.stringify({
    Changes: records.map((record) => ({
      Action: "UPSERT",
      ResourceRecordSet: {
        Name: record.name,
        Type: record.type,
        TTL: 60,
        ResourceRecords: [{ Value: record.value }],
      },
    })),
  });

  await execCommand(
    "aws",
    [
      "--profile",
      profile,
      "route53",
      "change-resource-record-sets",
      "--hosted-zone-id",
      hostedZoneId,
      "--change-batch",
      payload,
    ],
    { quiet: true },
  );
}

export async function waitForAcmValidationRecords(
  profile: string,
  region: string,
  certificateArn: string,
  maxAttempts = 20,
): Promise<AcmValidationRecord[]> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const description = await describeAcmCertificate(
      profile,
      region,
      certificateArn,
    );
    if (description.validationRecords.length > 0) {
      return description.validationRecords;
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  throw new Error(
    `Timed out waiting for ACM validation records: ${certificateArn}`,
  );
}

export async function waitForAcmCertificateIssued(
  profile: string,
  region: string,
  certificateArn: string,
  maxAttempts = 40,
): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const description = await describeAcmCertificate(
      profile,
      region,
      certificateArn,
    );

    if (description.status === "ISSUED") {
      return;
    }

    if (description.status === "FAILED") {
      throw new Error(`ACM certificate failed validation: ${certificateArn}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 15000));
  }

  throw new Error(
    `Timed out waiting for ACM certificate issuance: ${certificateArn}`,
  );
}
