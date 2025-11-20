"use client";

import rootPackageJson from "../../../../package.json";

export default function VersionInfo() {
  const version = rootPackageJson.version ?? "0.1.0";

  return <span>v{version}</span>;
}

