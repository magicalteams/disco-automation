/**
 * Seed script: creates 3-5 demo partner profiles for Phase 1A testing.
 * These are synthetic but realistic profiles to validate the matching pipeline.
 *
 * Usage: npm run seed:demo
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const demoProfiles = [
  {
    name: "Amanda Torres",
    company: "Antonym Creative",
    title: "Founder & Creative Director",
    industries: ["Editorial Media", "Brand Strategy", "Content Production"],
    servicesOffered: [
      "Brand storytelling",
      "Editorial strategy",
      "Content production",
      "Brand partnerships",
      "Community-driven media",
    ],
    targetClients:
      "Mission-driven brands, media companies, and cultural organizations targeting Gen Z to millennial audiences, particularly those centering Black women and underrepresented communities.",
    geographicFocus: ["United States", "New York"],
    companyStage: "agency",
    keyStrengths: [
      "Deep editorial expertise spanning digital and print",
      "Strong network in Black media and cultural spaces",
      "Ability to bridge brand and editorial voices authentically",
      "Community-first content strategy",
    ],
    uniquePositioning:
      "Amanda combines editorial leadership with brand strategy in a way that feels organic rather than transactional. Her work centering Black women's stories gives her credibility and access that purely commercial agencies lack.",
    currentChallenges: [
      "Scaling content production without diluting editorial quality",
      "Finding editorial talent who understand both brand and audience",
      "Building sustainable revenue beyond project-based work",
    ],
    idealIntroProfile:
      "Media companies expanding their reach to diverse audiences, brands seeking authentic community engagement, editorial leadership opportunities in mission-driven publications.",
    communicationStyle:
      "Direct, warm, and culturally fluent. Leads with vision and purpose rather than credentials.",
    matchingSummary:
      "Amanda Torres is the founder and creative director of Antonym Creative, an agency specializing in brand storytelling, editorial strategy, and content production. She serves mission-driven brands, media companies, and cultural organizations, with particular expertise in reaching Gen Z to millennial audiences and centering Black women and underrepresented communities in media. Based in New York, Amanda operates at the intersection of editorial media, brand strategy, and community-driven content. Her key strengths include deep editorial expertise across digital and print formats, a strong network in Black media and cultural spaces, and an ability to bridge brand and editorial voices authentically. What makes Amanda unique is her capacity to blend editorial leadership with brand strategy in ways that feel organic rather than commercial — her credibility comes from genuine community engagement, not just marketing positioning. Amanda currently faces challenges in scaling content production while maintaining editorial quality, finding talent who understand both brand objectives and audience nuance, and building sustainable revenue models beyond project-based work. She would benefit from introductions to media companies expanding to diverse audiences, brands seeking authentic community engagement strategies, and editorial leadership roles in mission-driven publications. Opportunities in editorial roles, brand storytelling projects, community membership organizations, and speaking engagements in media and culture spaces are highly relevant to her.",
    sourceType: "manual_paste" as const,
    sourceReference: "demo_seed",
    lastExtractedAt: new Date(),
    extractionModel: "demo_seed",
  },
  {
    name: "David Chen",
    company: "Meridian Ventures",
    title: "Managing Partner",
    industries: ["Venture Capital", "AI/ML", "Enterprise SaaS", "FinTech"],
    servicesOffered: [
      "Seed-stage investment",
      "Portfolio company advisory",
      "Go-to-market strategy",
      "Investor network introductions",
    ],
    targetClients:
      "Pre-seed and seed-stage B2B SaaS founders, particularly those building AI-first products for financial services, healthcare, and enterprise markets.",
    geographicFocus: ["San Francisco Bay Area", "United States"],
    companyStage: "startup",
    keyStrengths: [
      "Deep technical background in ML and distributed systems",
      "Extensive LP network across institutional and family office investors",
      "Track record of early-stage picks that scaled",
      "Hands-on product advisory for technical founders",
    ],
    uniquePositioning:
      "David's engineering background combined with investment experience makes him a rare technical-first investor who can evaluate product architectures, not just business models. His portfolio companies benefit from technical diligence that most seed funds can't provide.",
    currentChallenges: [
      "Differentiating deal flow in an increasingly crowded AI investment landscape",
      "Building brand presence beyond SF/Silicon Valley networks",
      "Expanding portfolio support capabilities without over-hiring",
    ],
    idealIntroProfile:
      "AI-first founders with technical depth, enterprise SaaS builders, angel syndicate co-investment opportunities, conference speaking slots on AI/VC topics.",
    communicationStyle:
      "Analytical and precise, with a bias toward data-driven conversations. Prefers structured discussions over casual networking.",
    matchingSummary:
      "David Chen is the managing partner of Meridian Ventures, a seed-stage venture capital firm focused on AI/ML, enterprise SaaS, and FinTech. Based in San Francisco, David invests in pre-seed and seed-stage B2B SaaS founders building AI-first products for financial services, healthcare, and enterprise markets. His key strengths include a deep technical background in ML and distributed systems, an extensive LP network, and hands-on product advisory capabilities that most seed investors lack. David's unique positioning is as a technical-first investor who evaluates product architectures, not just business models — giving his portfolio companies an advantage in technical diligence and product development. He currently faces challenges in differentiating deal flow in a crowded AI landscape, building brand presence beyond Silicon Valley, and expanding portfolio support without over-hiring. David would benefit from introductions to AI-first founders with technical depth, angel syndicate co-investment opportunities, and conference speaking opportunities on AI and venture capital topics. Opportunities involving AI/tech networking events, investment syndicates, developer conferences, and startup community events are highly relevant to him.",
    sourceType: "manual_paste" as const,
    sourceReference: "demo_seed",
    lastExtractedAt: new Date(),
    extractionModel: "demo_seed",
  },
  {
    name: "Priya Sharma",
    company: "Nourish Labs",
    title: "CEO & Co-Founder",
    industries: ["Food Technology", "Consumer Packaged Goods", "Sustainability", "AgTech"],
    servicesOffered: [
      "Plant-based product development",
      "Food supply chain innovation",
      "Sustainable packaging solutions",
      "DTC food brand building",
    ],
    targetClients:
      "Food companies transitioning to sustainable practices, grocery retailers seeking innovative products, impact investors in food/ag tech.",
    geographicFocus: ["United States", "Pacific Northwest", "Global (supply chain)"],
    companyStage: "growth",
    keyStrengths: [
      "Deep food science and formulation expertise",
      "Strong relationships with sustainable agriculture networks",
      "Proven DTC brand building with loyal community",
      "Supply chain innovation reducing costs and waste",
    ],
    uniquePositioning:
      "Priya bridges food science, sustainability, and brand building — a rare combination that lets Nourish Labs develop products that are both technically superior and commercially viable. Most food tech founders have one of these; she has all three.",
    currentChallenges: [
      "Scaling production while maintaining sustainable sourcing standards",
      "Breaking into traditional retail channels from a DTC base",
      "Fundraising for Series A in a down market for CPG/food tech",
      "Building executive team beyond founding duo",
    ],
    idealIntroProfile:
      "Impact investors in food/ag tech, retail buyers at natural/organic grocers, food industry conference organizers, women founder communities in food and sustainability.",
    communicationStyle:
      "Passionate and mission-driven, storytelling-oriented. Connects product details to broader sustainability impact naturally.",
    matchingSummary:
      "Priya Sharma is the CEO and co-founder of Nourish Labs, a food technology company focused on plant-based product development, sustainable packaging, and supply chain innovation. Based in the Pacific Northwest with global supply chain operations, Priya serves food companies transitioning to sustainable practices, grocery retailers seeking innovative products, and impact investors in food and agricultural technology. Her industries span food technology, consumer packaged goods, sustainability, and agtech. Priya's key strengths include deep food science expertise, strong relationships with sustainable agriculture networks, proven DTC brand building, and supply chain innovations that reduce both cost and waste. What makes her unique is the rare combination of food science, sustainability knowledge, and commercial brand-building ability — most food tech founders have one of these capabilities, but Priya has all three. She currently faces challenges in scaling production while maintaining sustainable sourcing, breaking into traditional retail from a DTC base, fundraising for Series A in a difficult CPG market, and building her executive team. Priya would benefit from introductions to impact investors, retail buyers at natural grocers, food industry conference opportunities, and women founder communities in food and sustainability. Community memberships in food/agriculture, investment opportunities in food tech, speaking engagements on sustainability, and networking events connecting women founders are highly relevant to her work.",
    sourceType: "manual_paste" as const,
    sourceReference: "demo_seed",
    lastExtractedAt: new Date(),
    extractionModel: "demo_seed",
  },
  {
    name: "Marcus Johnson",
    company: "Elevate Recruiting",
    title: "Founder & Principal Recruiter",
    industries: ["Executive Recruiting", "Tech Talent", "Diversity & Inclusion"],
    servicesOffered: [
      "Executive search for tech companies",
      "Diversity recruiting strategy",
      "Employer brand consulting",
      "Leadership team assessment",
    ],
    targetClients:
      "Series A-C tech startups building leadership teams, enterprise companies seeking diverse executive talent, PE/VC portfolio companies needing operating executives.",
    geographicFocus: ["United States", "Remote-first companies"],
    companyStage: "solo",
    keyStrengths: [
      "Extensive network across underrepresented executive talent",
      "Deep understanding of startup leadership needs at different stages",
      "Track record of placements that stay and grow with companies",
      "Trusted advisor relationship with both candidates and hiring companies",
    ],
    uniquePositioning:
      "Marcus's focus on diverse executive talent for tech companies fills a critical gap — most executive recruiters either specialize in diversity or in tech, but rarely both. His candidate relationships are built on years of community investment, not transactional sourcing.",
    currentChallenges: [
      "Scaling beyond solo practice without losing personal touch",
      "Establishing thought leadership through content and speaking",
      "Building recurring revenue beyond placement fees",
      "Competing with larger firms on retained search engagements",
    ],
    idealIntroProfile:
      "Tech startup founders seeking VP/C-level hires, VC firms building executive talent pipelines for portfolio, speaking opportunities on diversity in tech leadership, podcast guest spots.",
    communicationStyle:
      "Warm, relationship-first, thoughtful. Asks probing questions and listens deeply before advising.",
    matchingSummary:
      "Marcus Johnson is the founder and principal recruiter at Elevate Recruiting, specializing in executive search for tech companies with a focus on diversity and inclusion. Based in the US and serving remote-first companies, Marcus works with Series A through C tech startups building leadership teams, enterprise companies seeking diverse executive talent, and PE/VC portfolio companies needing operating executives. His industries span executive recruiting, tech talent, and diversity and inclusion. Marcus's key strengths include an extensive network across underrepresented executive talent, deep understanding of startup leadership needs at different stages, and a track record of long-lasting placements. His unique positioning fills a critical market gap — most recruiters specialize in either diversity or tech, but Marcus combines both, built on years of genuine community investment. He currently faces challenges in scaling his solo practice, establishing thought leadership through content and speaking, building recurring revenue models, and competing with larger firms. Marcus would benefit from introductions to tech founders hiring at the VP/C-level, VC firms building talent pipelines, speaking and podcast opportunities on diversity in tech leadership, and community memberships that expand his professional network. Leadership workshops, networking events, panel opportunities, podcast guest calls, and speaking engagements are highly relevant to his goals.",
    sourceType: "manual_paste" as const,
    sourceReference: "demo_seed",
    lastExtractedAt: new Date(),
    extractionModel: "demo_seed",
  },
  {
    name: "Sofia Reyes",
    company: "Puente Digital",
    title: "Founder & CEO",
    industries: ["Digital Marketing", "Latinx Market", "E-Commerce", "Social Media"],
    servicesOffered: [
      "Bilingual digital marketing strategy",
      "Social media management",
      "E-commerce growth consulting",
      "Influencer partnership management",
      "Cultural marketing campaigns",
    ],
    targetClients:
      "Consumer brands targeting US Latinx audiences, e-commerce companies expanding to Spanish-speaking markets, DTC brands seeking multicultural marketing.",
    geographicFocus: ["United States", "Latin America", "Miami", "Los Angeles"],
    companyStage: "agency",
    keyStrengths: [
      "Native bilingual fluency enabling authentic cultural messaging",
      "Deep understanding of US Latinx consumer behavior and media consumption",
      "Proven ROI track record in multicultural digital campaigns",
      "Strong influencer network across Latinx content creators",
    ],
    uniquePositioning:
      "Sofia's agency is one of the few that can authentically bridge US mainstream marketing and Latinx cultural marketing — not through translation, but through genuine bicultural fluency that resonates with audiences who navigate both worlds daily.",
    currentChallenges: [
      "Educating potential clients on the business case for Latinx-focused marketing",
      "Competing with larger agencies adding 'multicultural' as a service line",
      "Hiring bilingual talent with both cultural competence and technical marketing skills",
      "Expanding beyond Miami and LA to serve national brands",
    ],
    idealIntroProfile:
      "CMOs at consumer brands with Latinx growth ambitions, DTC founders entering multicultural markets, speaking opportunities on multicultural marketing strategy, community organizations supporting Latina entrepreneurs.",
    communicationStyle:
      "Energetic, data-forward, and culturally intuitive. Blends analytical rigor with storytelling that makes data come alive.",
    matchingSummary:
      "Sofia Reyes is the founder and CEO of Puente Digital, a digital marketing agency specializing in bilingual and multicultural marketing for the US Latinx market. Based in Miami and Los Angeles with reach into Latin America, Sofia serves consumer brands targeting US Latinx audiences, e-commerce companies expanding to Spanish-speaking markets, and DTC brands seeking multicultural marketing strategies. Her industries span digital marketing, the Latinx consumer market, e-commerce, and social media. Sofia's key strengths include native bilingual fluency enabling authentic cultural messaging, deep understanding of US Latinx consumer behavior, proven ROI in multicultural campaigns, and a strong influencer network across Latinx content creators. Her unique positioning is genuine bicultural fluency — not marketing through translation, but through understanding audiences who navigate both American and Latin cultures daily. She currently faces challenges in educating clients on the Latinx market opportunity, competing with larger agencies adding multicultural as an afterthought, hiring bilingual talent with both cultural and technical skills, and expanding to national brands. Sofia would benefit from introductions to CMOs at consumer brands with Latinx growth goals, DTC founders entering multicultural markets, speaking engagements on multicultural marketing, and Latina entrepreneur communities. Networking events, community memberships for women founders, speaking opportunities, and storytelling projects focused on immigrant or Latina experiences are highly relevant.",
    sourceType: "manual_paste" as const,
    sourceReference: "demo_seed",
    lastExtractedAt: new Date(),
    extractionModel: "demo_seed",
  },
];

async function seed() {
  console.log("Seeding demo partner profiles...\n");

  for (const profile of demoProfiles) {
    const result = await prisma.partnerProfile.upsert({
      where: {
        name_company: {
          name: profile.name,
          company: profile.company,
        },
      },
      update: { ...profile },
      create: { ...profile },
    });
    console.log(`  ✓ ${result.name} (${result.company}) — ${result.id}`);
  }

  console.log(`\nSeeded ${demoProfiles.length} partner profiles.`);
}

seed()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
