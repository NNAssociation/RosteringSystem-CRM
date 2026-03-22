"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface Tab {
    id: string;
    label: string;
    icon?: React.ReactNode;
}

interface TabsProps {
    tabs: Tab[];
    activeTab: string;
    onChange: (id: string) => void;
    className?: string;
    contentClassName?: string;
    children: React.ReactNode;
}

export function Tabs({ tabs, activeTab, onChange, className, contentClassName, children }: TabsProps) {
    return (
        <div className={cn("flex flex-col h-full", className)}>
            <div className="flex items-center gap-1 border-b border-slate-200/60 px-6 bg-white shadow-sm sticky top-0 z-10">
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => onChange(tab.id)}
                            className={cn(
                                "relative px-4 py-4 text-xs font-bold transition-colors outline-none",
                                isActive ? "text-primary" : "text-slate-400 hover:text-slate-600"
                            )}
                        >
                            <div className="flex items-center gap-2">
                                {tab.icon}
                                <span>{tab.label}</span>
                            </div>
                            {isActive && (
                                <motion.div
                                    layoutId="activeTabUnderline"
                                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                                />
                            )}
                        </button>
                    );
                })}
            </div>
            <div className={cn("flex-1 overflow-y-auto no-scrollbar", contentClassName)}>
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, x: 5 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -5 }}
                        transition={{ duration: 0.2 }}
                        className="h-full"
                    >
                        {React.Children.map(children, (child) => {
                            if (React.isValidElement(child) && child.props.value === activeTab) {
                                return child;
                            }
                            return null;
                        })}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}

export function TabContent({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
    return (
        <div className={cn("p-6 space-y-8 pb-12", className)}>
            {children}
        </div>
    );
}
