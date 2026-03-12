import { Button } from "@/components/ui/button";

export default function Dashboard() {
  return (
    <div className="p-8">
      <div className="max-w-7xl">
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Welcome to your Rostering System CRM
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-lg border border-gray-200 dark:border-gray-800">
            <h3 className="text-gray-600 dark:text-gray-400 text-sm font-medium">
              Total Customers
            </h3>
            <p className="text-3xl font-bold mt-2">0</p>
          </div>
          <div className="bg-white dark:bg-gray-900 p-6 rounded-lg border border-gray-200 dark:border-gray-800">
            <h3 className="text-gray-600 dark:text-gray-400 text-sm font-medium">
              Active Jobs
            </h3>
            <p className="text-3xl font-bold mt-2">0</p>
          </div>
          <div className="bg-white dark:bg-gray-900 p-6 rounded-lg border border-gray-200 dark:border-gray-800">
            <h3 className="text-gray-600 dark:text-gray-400 text-sm font-medium">
              Fleet Vehicles
            </h3>
            <p className="text-3xl font-bold mt-2">0</p>
          </div>
          <div className="bg-white dark:bg-gray-900 p-6 rounded-lg border border-gray-200 dark:border-gray-800">
            <h3 className="text-gray-600 dark:text-gray-400 text-sm font-medium">
              Total Users
            </h3>
            <p className="text-3xl font-bold mt-2">0</p>
          </div>
        </div>

        <Button>Get Started</Button>
      </div>
    </div>
  );
}
