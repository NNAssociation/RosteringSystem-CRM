"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";

type TestResult = {
  name: string;
  status: "passed" | "failed";
  duration: number;
};

type ReportData = {
  numTotalTestSuites: number;
  numPassedTestSuites: number;
  numFailedTestSuites: number;
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  testResults: {
    name: string;
    status: string;
    startTime: number;
    endTime: number;
    assertionResults: {
      title: string;
      status: "passed" | "failed";
      duration: number;
      failureMessages: string[];
    }[];
  }[];
};

export default function TestReportsPage() {
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTestReport();
  }, []);

  const fetchTestReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
      const res = await fetch(`${baseUrl}/api/reports/tests`);
      if (!res.ok) {
        throw new Error("Failed to fetch test reports. Ensure backend is running and tests have been executed.");
      }
      const data = await res.json();
      setReport(data);
    } catch (err: any) {
      setError(err.message || "An unknown error occurred.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 flex flex-col items-center">
          <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
          <h2 className="text-xl font-semibold text-red-700 dark:text-red-400 mb-2">Error Loading Report</h2>
          <p className="text-red-600 dark:text-red-300 text-center mb-6">{error}</p>
          <button
            onClick={fetchTestReport}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md font-medium transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!report) return null;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Scheduling Logic Test Report</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Automated verification of the 5 core scheduling rules with robust mock data.
          </p>
        </div>
        <button
          onClick={fetchTestReport}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-medium shadow-sm transition-colors"
        >
          Refresh Data
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Tests</div>
          <div className="text-3xl font-bold mt-2">{report.numTotalTests}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="text-sm font-medium text-green-600 dark:text-green-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Passed
          </div>
          <div className="text-3xl font-bold text-green-700 dark:text-green-500 mt-2">
            {report.numPassedTests}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="text-sm font-medium text-red-600 dark:text-red-400 flex items-center gap-2">
            <XCircle className="w-4 h-4" /> Failed
          </div>
          <div className="text-3xl font-bold text-red-700 dark:text-red-500 mt-2">
            {report.numFailedTests}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-2">
            <Clock className="w-4 h-4" /> Success Rate
          </div>
          <div className="text-3xl font-bold mt-2">
            {Math.round((report.numPassedTests / report.numTotalTests) * 100) || 0}%
          </div>
        </div>
      </div>

      {/* Detailed Results List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Rule Verification Details</h2>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {report.testResults.map((suite, idx) =>
            suite.assertionResults.map((assertion, aIdx) => (
              <div key={`${idx}-${aIdx}`} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    {assertion.status === "passed" ? (
                      <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <h3 className="text-base font-medium text-gray-900 dark:text-white">
                        {assertion.title}
                      </h3>
                      {assertion.status === "failed" && assertion.failureMessages?.length > 0 && (
                        <div className="mt-3 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 p-4 rounded-md text-sm font-mono whitespace-pre-wrap overflow-x-auto">
                          {assertion.failureMessages[0]}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-gray-500 flex items-center gap-1.5 shrink-0 ml-4">
                    <Clock className="w-4 h-4" />
                    {assertion.duration || 0}ms
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
