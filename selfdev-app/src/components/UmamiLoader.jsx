import { useEffect } from "react";
import conf from "../conf.js"

export default function UmamiScript() {
  useEffect(() => {
    if (!conf.umami.enable) {
      return;
    }

    const script = document.createElement("script");
    script.defer = true;
    script.src = conf.umami.url
    script.dataset.websiteId = conf.umami.websiteId
    document.head.appendChild(script);
  }, []);

  return null;
}
