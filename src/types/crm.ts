export type Account = {
  id: string;
  name: string;
  clia_name: string;
  clia_number: string;
  city: string;
  state: string;
  phone: string;
  website: string;
  stage: "prospect" | "contacted" | "qualified" | "proposal" | "negotiation" | "won" | "lost";
  last_activity_at: string | null;
};
