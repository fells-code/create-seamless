import {
  findExistingAcmCertificate,
  requestAcmCertificate,
  upsertRoute53Records,
  waitForAcmCertificateIssued,
  waitForAcmValidationRecords,
} from "./aws.js";
import { DeployManifest } from "./deployManifest.js";

export async function ensureAcmCertificate(
  manifest: DeployManifest,
): Promise<string> {
  const profile = manifest.awsProfile;
  const region = manifest.region;
  const zoneId = manifest.domain.hostedZoneId;

  if (!zoneId) {
    throw new Error("Missing hosted zone id for ACM validation");
  }

  if (manifest.runtime.acmCertificateArn) {
    return manifest.runtime.acmCertificateArn;
  }

  const existing = await findExistingAcmCertificate(
    profile,
    region,
    manifest.domain.root,
  );

  const certificateArn =
    existing ??
    (await requestAcmCertificate(profile, region, manifest.domain.root, [
      manifest.domain.apiHost,
      manifest.domain.authHost,
      manifest.domain.adminHost,
    ]));

  const validationRecords = await waitForAcmValidationRecords(
    profile,
    region,
    certificateArn,
  );

  await upsertRoute53Records(profile, zoneId, validationRecords);
  await waitForAcmCertificateIssued(profile, region, certificateArn);

  return certificateArn;
}
