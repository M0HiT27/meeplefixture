"use client";

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { generateFixtures, FixtureResult } from "@/lib/fixtureGenerator";
import * as XLSX from "xlsx";
import { Users, Settings, Download, Trophy, Hash, Check } from "lucide-react";
import { motion } from "motion/react";

export default function Page() {
  const [mInput, setMInput] = useState<string>("4");
  const [nInput, setNInput] = useState<string>("2");
  const [cyclesInput, setCyclesInput] = useState<string>("1");

  const m = parseInt(mInput, 10);
  const n = parseInt(nInput, 10);
  const cycles = parseInt(cyclesInput, 10);

  const isValidM = !isNaN(m) && m >= 2;
  const isValidN = !isNaN(n) && n >= 2;
  const isValidCycles = !isNaN(cycles) && cycles >= 1;
  const isValid = isValidM && isValidN && isValidCycles && m >= n;

  const validationError = (() => {
    if (!mInput) return "Please enter total players.";
    if (!nInput) return "Please enter players required to play.";
    if (!cyclesInput) return "Please enter cycles.";
    if (!isValidM) return "Total players must be at least 2.";
    if (!isValidN) return "Players required to play a game must be at least 2.";
    if (!isValidCycles) return "Cycles must be at least 1.";
    if (n > m)
      return "Players required to play a game cannot exceed total players.";
    return "";
  })();

  const [playerNames, setPlayerNames] = useState<Record<number, string>>({});
  const [fixtures, setFixtures] = useState<FixtureResult | null>(null);
  const [error, setError] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // Initialize player names when M changes
  useEffect(() => {
    if (!isValidM) return;
    setPlayerNames((prev) => {
      const newNames: Record<number, string> = { ...prev };
      for (let i = 1; i <= m; i++) {
        if (!newNames[i]) {
          newNames[i] = `Player ${i}`;
        }
      }
      return newNames;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m]);

  const handleGenerate = () => {
    if (!isValid) return;

    setError("");
    setFixtures(null);
    setIsGenerating(true);

    // Use timeout to allow UI to update to "generating" state before heavy calculation
    setTimeout(() => {
      try {
        const result = generateFixtures({ m, n, cycles });
        setFixtures(result);
      } catch (err: any) {
        setError(err.message || "Error generating fixtures");
      } finally {
        setIsGenerating(false);
      }
    }, 50);
  };

  const handleNameChange = (id: number, name: string) => {
    setPlayerNames((prev) => ({ ...prev, [id]: name }));
  };

  const downloadExcel = () => {
    if (!fixtures) return;

    // Prepare data for Excel
    const data = fixtures.matches.map((match, index) => {
      const rowData: Record<string, string> = {
        "Match #": `Match ${index + 1}`,
      };

      match.forEach((playerId, i) => {
        rowData[`Position ${i + 1}`] =
          playerNames[playerId] || `Player ${playerId}`;
      });

      return rowData;
    });

    const worksheet = XLSX.utils.json_to_sheet(data);

    // Make column widths a bit nicer
    const colWidths = [
      { wch: 10 }, // Match #
      ...Array.from({ length: n }).map(() => ({ wch: 20 })), // Player columns
    ];
    worksheet["!cols"] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Fixtures");

    XLSX.writeFile(workbook, "league_fixtures.xlsx");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-6 md:p-12">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex items-center space-x-3 pb-6 border-b border-slate-200">
          <div className="bg-indigo-600 p-2.5 rounded-xl text-white">
            <Trophy size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              League Fixtures
            </h1>
            <p className="text-slate-500 font-medium mt-1">
              Generate fair, balanced match schedules
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Configuration & Players */}
          <div className="lg:col-span-4 space-y-6">
            {/* Settings Card */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center space-x-2 bg-slate-50/50">
                <Settings size={18} className="text-slate-500" />
                <h2 className="font-semibold text-slate-800">Match Settings</h2>
              </div>
              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Total Players (M)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={mInput}
                    onChange={(e) =>
                      setMInput(e.target.value.replace(/[^0-9]/g, ""))
                    }
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Players required to play a game (N)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={nInput}
                    onChange={(e) =>
                      setNInput(e.target.value.replace(/[^0-9]/g, ""))
                    }
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Equalization Cycles
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={cyclesInput}
                    onChange={(e) =>
                      setCyclesInput(e.target.value.replace(/[^0-9]/g, ""))
                    }
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                  />
                </div>

                <div className="pt-2">
                  {validationError && (
                    <p className="text-red-500 text-sm font-medium mb-3 bg-red-50 p-3 rounded-lg border border-red-100">
                      {validationError}
                    </p>
                  )}
                  {error && (
                    <p className="text-red-500 text-sm font-medium mb-3 bg-red-50 p-3 rounded-lg border border-red-100">
                      {error}
                    </p>
                  )}
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating || !isValid}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
                  >
                    {isGenerating ? (
                      <span className="flex items-center space-x-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Generating...</span>
                      </span>
                    ) : (
                      "Generate Fixtures"
                    )}
                  </button>
                </div>
              </div>
            </section>

            {/* Players Card */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col max-h-[600px]">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
                <div className="flex items-center space-x-2">
                  <Users size={18} className="text-slate-500" />
                  <h2 className="font-semibold text-slate-800">Player Names</h2>
                </div>
                <span className="text-xs font-semibold bg-indigo-100 text-indigo-700 px-2 py-1 rounded-md">
                  {isValidM ? m : 0} Players
                </span>
              </div>
              <div className="p-4 overflow-y-auto space-y-2">
                {Array.from({ length: isValidM ? m : 0 }).map((_, idx) => {
                  const id = idx + 1;
                  return (
                    <div
                      key={id}
                      className="flex items-center space-x-3 bg-slate-50 p-2 rounded-lg border border-slate-100"
                    >
                      <div className="w-8 h-8 rounded-md bg-white border border-slate-200 flex items-center justify-center shrink-0 text-slate-500 font-mono text-sm font-medium">
                        {id}
                      </div>
                      <input
                        type="text"
                        value={playerNames[id] || ""}
                        onChange={(e) => handleNameChange(id, e.target.value)}
                        placeholder={`Player ${id}`}
                        className="flex-1 bg-transparent border-none outline-none text-slate-700 font-medium placeholder-slate-400 focus:ring-0 px-1 py-1"
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Right Column: Results */}
          <div className="lg:col-span-8">
            {fixtures ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Stats Overview */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                      <Hash size={24} />
                    </div>
                    <div>
                      <p className="text-slate-500 text-sm font-medium mb-0.5">
                        Total Matches
                      </p>
                      <p className="text-3xl font-bold text-slate-900">
                        {fixtures.totalMatches}
                      </p>
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                      <Check size={24} />
                    </div>
                    <div>
                      <p className="text-slate-500 text-sm font-medium mb-0.5">
                        Matches per Player
                      </p>
                      <p className="text-3xl font-bold text-slate-900">
                        {fixtures.matchesPerPlayer[1] || 0}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Fixtures List */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <h2 className="font-semibold text-slate-800">
                      Generated Schedule
                    </h2>
                    <button
                      onClick={downloadExcel}
                      className="flex items-center space-x-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-lg transition-colors"
                    >
                      <Download size={16} />
                      <span>Download Excel</span>
                    </button>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {fixtures.matches.map((match, idx) => (
                        <div
                          key={idx}
                          className="bg-slate-50 rounded-xl border border-slate-200 p-4"
                        >
                          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200/60">
                            <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">
                              Match {idx + 1}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {match.map((playerId) => (
                              <span
                                key={playerId}
                                className="inline-flex items-center px-2.5 py-1 rounded-md bg-white border border-slate-200 text-sm font-medium text-slate-700 shadow-sm"
                              >
                                {playerNames[playerId] || `Player ${playerId}`}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl bg-white/50 text-slate-400">
                <Trophy size={48} className="mb-4 text-slate-300" />
                <p className="text-lg font-medium text-slate-600">
                  No Fixtures Generated
                </p>
                <p className="text-sm mt-1 max-w-sm text-center">
                  Configure your match settings and player names on the left,
                  then click Generate to create a fair schedule.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
