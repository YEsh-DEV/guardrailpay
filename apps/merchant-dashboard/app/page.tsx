import React from 'react';
import LenisSmoothScroll from './components/LenisSmoothScroll';
import CustomCursor from './components/CustomCursor';
import Nav from './components/Nav';
import HeroSection from './components/HeroSection';
import FeatureSectionA from './components/FeatureSectionA';
import FeatureSectionB from './components/FeatureSectionB';
import FeatureSectionC from './components/FeatureSectionC';
import AIChatDemoSection from './components/AIChatDemoSection';
import SafeRotationSection from './components/SafeRotationSection';
import VerdictMarquee from './components/VerdictMarquee';
import LiveCounterSection from './components/LiveCounterSection';
import FinalCTAAndFooter from './components/FinalCTAAndFooter';

export default function HomePage() {
  return (
    <LenisSmoothScroll>
      <CustomCursor />
      <Nav />
      <main className="relative bg-[#081014] text-white selection:bg-[#00FF59] selection:text-[#081014]">
        <HeroSection />
        <FeatureSectionA />
        <FeatureSectionB />
        <FeatureSectionC />
        <AIChatDemoSection />
        <SafeRotationSection />
        <VerdictMarquee />
        <LiveCounterSection />
        <FinalCTAAndFooter />
      </main>
    </LenisSmoothScroll>
  );
}
