// The shop's policies, as the website shows them (Privacy, Terms and conditions, Return and cancellation).
// {name}, {phone} and {email} are filled in from the shop settings.

export interface Policy {
  slug: "privacy-policy" | "terms-and-conditions" | "return-policy";
  title: string;
  short: string; // for links, e.g. "Privacy policy"
  intro: string[];
  sections: { h: string; p: string[] }[];
}

export const POLICY_EFFECTIVE = "12 November 2026";

export const POLICIES: Policy[] = [
  {
    slug: "privacy-policy",
    title: "Privacy Policy for {name}",
    short: "Privacy policy",
    intro: [
      'Welcome to {name} ("we," "us," or "our"). This document outlines our practices concerning the collection, utilization, and disclosure of Personal Information gathered from visitors to the site. Your Personal Information is collected exclusively to operate and enhance our site. By accessing and using the site, you consent to the gathering and use of your information as detailed in this policy.',
    ],
    sections: [
      {
        h: "Collection and Use of Personal Information",
        p: ['To enable us to contact you while you navigate our site, we may request certain personally identifiable details. This "Personal Information" can include, without limitation, details such as your full name, phone number, mailing address, and email address.'],
      },
      {
        h: "Log Data",
        p: ['As with most web platforms, we automatically gather details transmitted by your web browser upon visiting our website ("Log Data"). This data encompasses metrics including your device\'s Internet Protocol address, browser specifications and release version, specific pages accessed, timestamps of your session, duration spent across pages, alongside related analytical usage metrics.'],
      },
      {
        h: "Cookies",
        p: [
          "Cookies are files with small amounts of data, which may include an anonymous unique identifier. Cookies are sent to your browser from a website and stored on your computer's hard drive.",
          'Like many sites, we use "cookies" to collect information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. However, if you do not accept cookies, you may not be able to use some portions of our site.',
          "In practice our website only uses the cookies it needs to work - the one that keeps you logged in to your account - and keeps your cart in your browser. We do not use advertising or tracking cookies. The first time you visit, a banner lets you accept or decline cookies; declining keeps only the ones the website needs to work.",
        ],
      },
      {
        h: "Security",
        p: ["The security of your Personal Information is important to us, but remember that no method of transmission over the Internet, or method of electronic storage, is 100% secure. While we strive to use commercially acceptable means to protect your Personal Information, we cannot guarantee its absolute security."],
      },
      {
        h: "Changes to This Privacy Policy",
        p: [
          `This Privacy Policy is effective as of ${POLICY_EFFECTIVE} and will remain in effect except concerning any changes in its provisions in the future, which will be in effect immediately after being posted on this page.`,
          "We reserve the right to update or change our Privacy Policy at any time, and you should check this Privacy Policy periodically. Your continued use of the service after we post any modifications to the Privacy Policy on this page will constitute your acknowledgment of the modifications and your consent to abide by and be bound by the modified Privacy Policy.",
          "If we make any material changes to this Privacy Policy, we will notify you either through the email address you have provided us or by placing a prominent notice on our website.",
        ],
      },
      { h: "Contact Us", p: ["If you have any questions about this Privacy Policy, please contact us at {phone} or {email}."] },
    ],
  },
  {
    slug: "terms-and-conditions",
    title: "Terms and Conditions for {name}",
    short: "Terms and conditions",
    intro: ['Please read these Terms and Conditions ("Terms", "Terms and Conditions") carefully before using the website (the "Service") operated by {name} ("us", "we", or "our").'],
    sections: [
      { h: "1. Acceptance of Terms", p: ["By accessing or using the Service, you agree to be bound by these Terms. If you disagree with any part of the terms, then you may not access the Service."] },
      { h: "2. Accounts", p: ["When you create an account with us, you must provide accurate and complete information. You are responsible for maintaining the confidentiality of your account and password. You agree to accept responsibility for all activities that occur under your account."] },
      { h: "3. Product Information", p: ["We make every effort to display as accurately as possible the colors, features, specifications, and details of the products available on our website. However, we do not guarantee that the colors, features, specifications, and details of the products will be accurate, complete, reliable, current, or free of other errors."] },
      { h: "4. Pricing and Payment", p: ["Prices for products are subject to change without notice. We reserve the right at any time to modify or discontinue the Service (or any part or content thereof) without notice at any time. We shall not be liable to you or to any third-party for any modification, price change, suspension, or discontinuance of the Service."] },
      { h: "5. Shipping and Delivery", p: ["Our aim is to ship orders promptly; however, delivery times may vary. We are not liable for delays in shipping or delivery due to force majeure events or other reasons beyond our reasonable control."] },
      { h: "6. Returns and Refunds", p: ["Please review our Return Policy posted on the website for information on returns and refunds."] },
      { h: "7. Intellectual Property", p: ["The Service and its original content, features, and functionality are and will remain the exclusive property of {name} and its licensors."] },
      { h: "8. Links to Other Websites", p: ["Our Service may contain links to third-party websites or services that are not owned or controlled by {name}. {name} has no control over and assumes no responsibility for the content, privacy policies, or practices of any third-party websites or services."] },
      { h: "9. Governing Law", p: ["These Terms shall be governed and construed in accordance with the laws of Bangladesh, without regard to its conflict of law provisions."] },
      { h: "10. Changes", p: ["We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material, we will try to provide at least 30 days' notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion."] },
      { h: "Contact Us", p: ["If you have any questions about these Terms and Conditions, please contact us at {phone} or {email}."] },
    ],
  },
  {
    slug: "return-policy",
    title: "Return and Cancellation Policy for {name}",
    short: "Return policy",
    intro: ["Thank you for shopping at {name}. Please read this policy carefully. Your satisfaction is our priority, and we want to ensure a transparent and hassle-free experience for you."],
    sections: [
      {
        h: "1. Refund Policy",
        p: [
          "We strive to provide products and services that meet or exceed your expectations. If, for any reason, you are not completely satisfied with your purchase, you may be eligible for a refund under the following conditions:",
          "Damaged or Defective Products: If you receive a damaged or defective product, please contact our customer service team as soon as possible to receive the item. We will provide instructions on returning the product, and upon verification, a full refund or replacement will be issued.",
          "Incorrect Items: If you receive an incorrect item, please notify us as soon as possible of receiving the product. We will arrange for the correct item to be shipped to you, and you may be required to return the incorrect item.",
          "Please note that certain items, such as personalized or customized products, may not be eligible for a refund unless they are damaged or defective.",
        ],
      },
      {
        h: "2. Return Policy",
        p: [
          "To initiate a return, please contact our customer service team at {phone} or {email}. Our team will provide you with instructions on how to return the item. Please ensure that the item is securely packaged to prevent damage during transit.",
          "Once we receive the returned item and verify its condition, we will process the refund or replacement accordingly. Refunds will be issued to the original payment method.",
        ],
      },
      {
        h: "3. Cancellation Policy",
        p: ["You may cancel an order as soon as possible, provided that the order has not already been processed or shipped. To cancel an order, please contact our customer service team immediately at {phone} or {email}. If the order has already been processed, you may need to follow our return policy upon receipt of the items."],
      },
      {
        h: "Contact Us",
        p: ["If you have any questions about our Refund, Return, and Cancellation Policy, please contact us at {phone} or {email}. We are here to assist you and ensure your shopping experience with us is positive and satisfying."],
      },
    ],
  },
];

export const policy = (slug: Policy["slug"]) => POLICIES.find((p) => p.slug === slug)!;

export const fillPolicy = (text: string, shop: { name: string; phone: string; email: string }) =>
  text.replace(/\{name\}/g, shop.name).replace(/\{phone\}/g, shop.phone).replace(/\{email\}/g, shop.email);
