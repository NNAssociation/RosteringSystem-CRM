"use client";

import { PUNCHBOWL_DEFAULT_PRICING, type CharterPricingConfig } from "@/lib/charter-pricing";
import { useWorkflowApi } from "@/lib/workflow-api";
import { useEffect, useState } from "react";

export function useCharterPricingSettings() {
  const api = useWorkflowApi();
  const [config, setConfig] = useState<CharterPricingConfig>(PUNCHBOWL_DEFAULT_PRICING);
  const [originalConfig, setOriginalConfig] = useState(config);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const loaded: CharterPricingConfig = await api(
          "settings/charter-pricing",
          "GET",
          undefined,
          false,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setConfig(loaded);
        setOriginalConfig(loaded);
      } catch (cause) {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : "Unable to load pricing rates");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [api, revision]);

  async function save() {
    setSaving(true);
    try {
      const updated: CharterPricingConfig = await api("settings/charter-pricing", "PUT", config);
      setConfig(updated);
      setOriginalConfig(updated);
      return updated;
    } finally {
      setSaving(false);
    }
  }

  return {
    config,
    setConfig,
    loading,
    saving,
    error,
    save,
    cancel: () => setConfig(originalConfig),
    retry: () => setRevision((value) => value + 1),
  };
}
