import * as p from "@clack/prompts";
import pc from "picocolors";
import {
  BackupConfig,
  BackupSchedule,
  DeployTier,
  ResolvedDeployAnswers,
  SeamlessConfig,
  buildDefaultDomainConfig,
  getExistingDeployDefaults,
} from "../core/deployConfig.js";
import { listHostedZones } from "../core/aws.js";

function ensureNonEmptyString(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} is required`);
  }
  return trimmed;
}

function ensurePositiveNumber(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive number`);
  }
  return parsed;
}

function validateRequiredText(label: string) {
  return (value?: string) => {
    if (!value || value.trim().length === 0) {
      return `${label} is required`;
    }
    return undefined;
  };
}

function validatePositiveNumber(label: string) {
  return (value?: string) => {
    if (!value || value.trim().length === 0) {
      return `${label} is required`;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return `${label} must be a positive number`;
    }

    return undefined;
  };
}

export async function promptDeploySetup(
  config: SeamlessConfig,
): Promise<ResolvedDeployAnswers> {
  const defaults = getExistingDeployDefaults(config);

  p.intro(pc.cyan("Seamless deploy"));

  const shouldContinue = await p.confirm({
    message:
      "This will provision AWS infrastructure and may create billable resources. Continue?",
    initialValue: true,
  });

  if (p.isCancel(shouldContinue) || !shouldContinue) {
    p.cancel("Deploy cancelled");
    process.exit(0);
  }

  const tier = await p.select({
    message: "Select deployment tier",
    options: [
      { value: "dev", label: "dev", hint: "lowest cost, single-instance MVP" },
      {
        value: "standard",
        label: "standard",
        hint: "reserved for future implementation",
      },
      {
        value: "enterprise",
        label: "enterprise",
        hint: "reserved for future implementation",
      },
    ],
    initialValue: defaults.tier ?? "dev",
  });

  if (p.isCancel(tier)) {
    p.cancel("Deploy cancelled");
    process.exit(0);
  }

  const region = await p.text({
    message: "AWS region",
    initialValue: defaults.region ?? "us-east-1",
    validate: validateRequiredText("Region"),
  });

  if (p.isCancel(region)) {
    p.cancel("Deploy cancelled");
    process.exit(0);
  }

  const awsProfile = await p.text({
    message: "AWS profile",
    initialValue: defaults.awsProfile ?? "default",
    validate: validateRequiredText("AWS profile"),
  });

  if (p.isCancel(awsProfile)) {
    p.cancel("Deploy cancelled");
    process.exit(0);
  }

  const zoneSpinner = p.spinner();
  zoneSpinner.start("Loading hosted zones from Route 53");

  let hostedZones: Awaited<ReturnType<typeof listHostedZones>> = [];
  try {
    hostedZones = await listHostedZones(awsProfile, region);
    zoneSpinner.stop("Hosted zones loaded");
  } catch (error) {
    zoneSpinner.stop("Failed to load hosted zones");
    const message = error instanceof Error ? error.message : "Unknown error";
    p.log.error(message);
    process.exit(1);
  }

  if (hostedZones.length === 0) {
    p.log.error(
      "No public Route 53 hosted zones were found in this AWS account.",
    );
    process.exit(1);
  }

  const hostedZone = await p.select({
    message: "Select hosted zone",
    options: hostedZones.map((zone) => ({
      value: JSON.stringify({ name: zone.name, id: zone.id }),
      label: zone.name,
      hint: zone.id,
    })),
    initialValue:
      defaults.domain?.hostedZoneId && defaults.domain?.hostedZoneDomain
        ? JSON.stringify({
            name: defaults.domain.hostedZoneDomain,
            id: defaults.domain.hostedZoneId,
          })
        : JSON.stringify({
            name: hostedZones[0]?.name,
            id: hostedZones[0]?.id,
          }),
  });

  const rootDomain = await p.text({
    message: "Root domain for this deployment",
    initialValue: defaults.domain?.root ?? "",
    placeholder: "seamlessreviewboard.com",
    validate: validateRequiredText("Root domain"),
  });

  if (p.isCancel(hostedZone)) {
    p.cancel("Deploy cancelled");
    process.exit(0);
  }

  const selectedHostedZone = JSON.parse(hostedZone) as {
    name: string;
    id: string;
  };
  const hostedZoneDomain = selectedHostedZone.name;
  const hostedZoneId = selectedHostedZone.id;

  const domainDefaults = buildDefaultDomainConfig(
    ensureNonEmptyString(rootDomain as string, "Root domain"),
    ensureNonEmptyString(hostedZoneDomain, "Hosted zone domain"),
    ensureNonEmptyString(hostedZoneId, "Hosted zone id"),
  );
  const webHost = await p.text({
    message: "Web host",
    initialValue: defaults.domain?.webHost ?? domainDefaults.webHost,
    validate: validateRequiredText("Web host"),
  });

  if (p.isCancel(webHost)) {
    p.cancel("Deploy cancelled");
    process.exit(0);
  }

  const apiHost = await p.text({
    message: "API host",
    initialValue: defaults.domain?.apiHost ?? domainDefaults.apiHost,
    validate: validateRequiredText("API host"),
  });

  if (p.isCancel(apiHost)) {
    p.cancel("Deploy cancelled");
    process.exit(0);
  }

  const authHost = await p.text({
    message: "Auth host",
    initialValue: defaults.domain?.authHost ?? domainDefaults.authHost,
    validate: validateRequiredText("Auth host"),
  });

  if (p.isCancel(authHost)) {
    p.cancel("Deploy cancelled");
    process.exit(0);
  }

  const adminHost = await p.text({
    message: "Admin host",
    initialValue: defaults.domain?.adminHost ?? domainDefaults.adminHost,
    validate: validateRequiredText("Admin host"),
  });

  if (p.isCancel(adminHost)) {
    p.cancel("Deploy cancelled");
    process.exit(0);
  }

  const backupEnabled = await p.confirm({
    message: "Enable scheduled Postgres backups to S3?",
    initialValue: defaults.backup?.enabled ?? true,
  });

  if (p.isCancel(backupEnabled)) {
    p.cancel("Deploy cancelled");
    process.exit(0);
  }

  let backup: BackupConfig = {
    enabled: false,
    schedule: defaults.backup?.schedule ?? "daily",
    retentionDays: defaults.backup?.retentionDays ?? 30,
  };

  if (backupEnabled) {
    const backupSchedule = await p.select({
      message: "Backup schedule",
      options: [
        { value: "hourly", label: "hourly" },
        { value: "daily", label: "daily" },
        { value: "weekly", label: "weekly" },
      ],
      initialValue: defaults.backup?.schedule ?? "daily",
    });

    if (p.isCancel(backupSchedule)) {
      p.cancel("Deploy cancelled");
      process.exit(0);
    }

    const retentionDays = await p.text({
      message: "Backup retention days",
      initialValue: String(defaults.backup?.retentionDays ?? 30),
      validate: validatePositiveNumber("Backup retention days"),
    });

    if (p.isCancel(retentionDays)) {
      p.cancel("Deploy cancelled");
      process.exit(0);
    }

    backup = {
      enabled: true,
      schedule: backupSchedule as BackupSchedule,
      retentionDays: ensurePositiveNumber(
        retentionDays,
        "Backup retention days",
      ),
    };
  }

  const answers: ResolvedDeployAnswers = {
    provider: "aws",
    tier: tier as DeployTier,
    region: ensureNonEmptyString(region, "AWS region"),
    awsProfile: ensureNonEmptyString(awsProfile, "AWS profile"),
    domain: {
      root: ensureNonEmptyString(rootDomain as string, "Root domain"),
      hostedZoneDomain: ensureNonEmptyString(
        hostedZoneDomain,
        "Hosted zone domain",
      ),
      hostedZoneId: ensureNonEmptyString(hostedZoneId, "Hosted zone id"),
      webHost: ensureNonEmptyString(webHost, "Web host"),
      apiHost: ensureNonEmptyString(apiHost, "API host"),
      authHost: ensureNonEmptyString(authHost, "Auth host"),
      adminHost: ensureNonEmptyString(adminHost, "Admin host"),
    },
    backup,
  };

  p.note(
    [
      `Tier: ${answers.tier}`,
      `Region: ${answers.region}`,
      `Profile: ${answers.awsProfile}`,
      `Hosted zone: ${answers.domain.hostedZoneDomain}`,
      `Web: https://${answers.domain.webHost}`,
      `API: https://${answers.domain.apiHost}`,
      `Auth: https://${answers.domain.authHost}`,
      `Admin: https://${answers.domain.adminHost}`,
      `Backups: ${answers.backup.enabled ? `${answers.backup.schedule}, ${answers.backup.retentionDays} days` : "disabled"}`,
    ].join("\n"),
    "Deployment summary",
  );

  return answers;
}
