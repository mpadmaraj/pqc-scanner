import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Shield, CheckCircle, Clock } from "lucide-react";

interface StatsCardsProps {
  stats?: {
    criticalVulnerabilities: number;
    quantumVulnerable: number;
    pqcCompliant: number;
    activeScans: number;
  };
}

export default function StatsCards({ stats }: StatsCardsProps) {
  const defaultStats = {
    criticalVulnerabilities: 0,
    quantumVulnerable: 0,
    pqcCompliant: 0,
    activeScans: 0,
  };

  const data = stats || defaultStats;

  const cards = [
    {
      title: "Critical Vulnerabilities",
      value: data.criticalVulnerabilities,
      icon: AlertTriangle,
      color: "text-red-600",
      bgColor: "bg-red-50",
      testId: "stat-critical-vulnerabilities"
    },
    {
      title: "Quantum-Vulnerable",
      value: data.quantumVulnerable,
      icon: Shield,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      testId: "stat-quantum-vulnerable"
    },
    {
      title: "PQC Compliant",
      value: data.pqcCompliant,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-50",
      testId: "stat-pqc-compliant"
    },
    {
      title: "Active Scans",
      value: data.activeScans,
      icon: Clock,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      testId: "stat-active-scans"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {cards.map((card) => (
        <Card key={card.title} className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${card.bgColor}`}>
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                <p className="text-2xl font-semibold text-foreground" data-testid={card.testId}>
                  {card.value}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
