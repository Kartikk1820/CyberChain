export interface MitreTechnique {
  id: string;
  name: string;
  keywords: string[];
  defaultAttackType: string;
}

export const MITRE_TECHNIQUES: MitreTechnique[] = [
  { id: "T1566", name: "Phishing", keywords: ["phishing", "spearphishing", "email", "lure"], defaultAttackType: "Phishing" },
  { id: "T1071", name: "Application Layer Protocol (C2)", keywords: ["c2", "command and control", "beacon", "callback"], defaultAttackType: "Command & Control" },
  { id: "T1110", name: "Brute Force", keywords: ["brute force", "credential stuffing", "password spray"], defaultAttackType: "Brute Force" },
  { id: "T1486", name: "Data Encrypted for Impact", keywords: ["ransomware", "encrypt", "extortion"], defaultAttackType: "Ransomware" },
  { id: "T1190", name: "Exploit Public-Facing Application", keywords: ["exploit", "rce", "vulnerability", "cve"], defaultAttackType: "Exploitation" },
  { id: "T1059", name: "Command and Scripting Interpreter", keywords: ["malware", "script", "payload", "trojan"], defaultAttackType: "Malware" },
  { id: "T1498", name: "Network Denial of Service", keywords: ["ddos", "dos", "flood"], defaultAttackType: "DDoS" },
  { id: "T1595", name: "Active Scanning", keywords: ["scan", "recon", "probing"], defaultAttackType: "Reconnaissance" },
];

export const DEFAULT_TECHNIQUE: MitreTechnique = {
  id: "T1583",
  name: "Acquire Infrastructure",
  keywords: [],
  defaultAttackType: "Suspicious Activity",
};

export function lookupTechnique(text: string): MitreTechnique {
  const lower = text.toLowerCase();
  for (const technique of MITRE_TECHNIQUES) {
    if (technique.keywords.some((kw) => lower.includes(kw))) {
      return technique;
    }
  }
  return DEFAULT_TECHNIQUE;
}
