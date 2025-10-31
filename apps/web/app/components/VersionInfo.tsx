"use client";

import { useEffect, useState } from "react";

interface VersionData {
  version: string;
  buildDate?: string;
}

export default function VersionInfo() {
  const [version, setVersion] = useState<string>("0.1.0");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/version.json")
      .then((res) => res.json())
      .then((data: VersionData) => {
        setVersion(data.version || "0.1.0");
        setLoading(false);
      })
      .catch(() => {
        // Fallback si le fichier n'existe pas encore
        setVersion("0.1.0");
        setLoading(false);
      });
  }, []);

  if (loading) {
    return null;
  }

  return <span>v{version}</span>;
}

