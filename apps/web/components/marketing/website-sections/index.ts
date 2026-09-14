import { HeroSection } from "./hero";
import { AboutSection } from "./about";
import { ServicesSection } from "./services";
import { TeamSection } from "./team";
import { ReviewsSection } from "./reviews";
import { FaqSection } from "./faq";
import { HoursLocationSection } from "./hours-location";
import { BookingCtaSection } from "./booking-cta";
import { GallerySection } from "./gallery";
import { HandoutsSection } from "./handouts";
import { TrustBadgesSection } from "./trust-badges";
import { StatsSection } from "./stats";
import { EmergencyBannerSection } from "./emergency-banner";
import { ContactFormSection } from "./contact-form";
import { VideoEmbedSection } from "./video-embed";
import { SocialProofSection } from "./social-proof";
import { CustomRichTextSection } from "./custom-rich-text";
import type { SectionType } from "@/lib/marketing/website-builder-types";

export const SECTION_COMPONENTS: Record<
  SectionType,
  React.ComponentType<{
    content: any;
    brandKit?: any;
    contextData?: any;
    isEditor?: boolean;
  }>
> = {
  hero: HeroSection,
  about: AboutSection,
  services: ServicesSection,
  team: TeamSection,
  reviews: ReviewsSection,
  faq: FaqSection,
  hours_location: HoursLocationSection,
  booking_cta: BookingCtaSection,
  gallery: GallerySection,
  handouts: HandoutsSection,
  trust_badges: TrustBadgesSection,
  stats: StatsSection,
  emergency_banner: EmergencyBannerSection,
  contact_form: ContactFormSection,
  video_embed: VideoEmbedSection,
  social_proof: SocialProofSection,
  custom_rich_text: CustomRichTextSection,
};

export {
  HeroSection,
  AboutSection,
  ServicesSection,
  TeamSection,
  ReviewsSection,
  FaqSection,
  HoursLocationSection,
  BookingCtaSection,
  GallerySection,
  HandoutsSection,
  TrustBadgesSection,
  StatsSection,
  EmergencyBannerSection,
  ContactFormSection,
  VideoEmbedSection,
  SocialProofSection,
  CustomRichTextSection,
};
