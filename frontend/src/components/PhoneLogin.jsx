import { useEffect, useState } from "react";
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { auth } from "../firebase";
import { useLang } from "../i18n";

export default function PhoneLogin({ onSuccess }) {
  const { t } = useLang();
  const [phone, setPhone] = useState("+7 ");
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Clean up recaptcha verifier when component unmounts
    return () => {
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
        } catch {
          // ignore cleanup issues
        }
        window.recaptchaVerifier = null;
      }
    };
  }, []);

  const handleSendCode = async (e) => {
    e.preventDefault();
    setError(null);
    const cleanedPhone = phone.replace(/[\s-]/g, "");
    if (cleanedPhone.length < 9) {
      setError("Please enter a valid phone number with country code.");
      return;
    }

    setLoading(true);
    try {
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
          size: "invisible",
          callback: () => {
            // reCAPTCHA solved
          },
        });
      }

      const confirmation = await signInWithPhoneNumber(
        auth,
        cleanedPhone,
        window.recaptchaVerifier
      );
      setConfirmationResult(confirmation);
    } catch (err) {
      console.error("Phone verification error:", err);
      if (err.code === "auth/invalid-api-key" || err.code === "auth/configuration-not-found") {
        setError(
          "Firebase is configured with placeholder keys in frontend/src/firebase.js. Please provide valid Firebase credentials to send SMS."
        );
      } else {
        setError(err.message || "Failed to send SMS code. Please check the number and try again.");
      }
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
        } catch {
          // ignore
        }
        window.recaptchaVerifier = null;
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    if (!verificationCode.trim() || !confirmationResult) return;

    setLoading(true);
    setError(null);
    try {
      await confirmationResult.confirm(verificationCode.trim());
      onSuccess?.();
    } catch (err) {
      console.error("Code confirmation error:", err);
      setError(err.message || "Incorrect verification code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setConfirmationResult(null);
    setVerificationCode("");
    setError(null);
  };

  return (
    <div className="phone-login-card">
      <div id="recaptcha-container"></div>

      {!confirmationResult ? (
        <form onSubmit={handleSendCode}>
          <div className="form-field">
            <label htmlFor="phone-input">{t("phone_enter_number")}</label>
            <input
              id="phone-input"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t("phone_number_placeholder")}
              required
              disabled={loading}
            />
          </div>

          {error && <div className="callout callout-error">{error}</div>}

          <div className="btn-row">
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: "100%" }}
              disabled={loading}
            >
              {loading ? t("phone_sending_code") : t("phone_send_code")}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleVerifyCode}>
          <div className="form-field">
            <label htmlFor="code-input">{t("phone_enter_code")}</label>
            <input
              id="code-input"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              placeholder={t("phone_code_placeholder")}
              required
              autoFocus
              disabled={loading}
            />
          </div>

          {error && <div className="callout callout-error">{error}</div>}

          <div className="btn-row" style={{ flexDirection: "column" }}>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: "100%" }}
              disabled={loading || verificationCode.trim().length < 4}
            >
              {loading ? t("phone_verifying") : t("phone_verify_btn")}
            </button>
            <button
              type="button"
              className="btn"
              onClick={handleReset}
              disabled={loading}
              style={{ width: "100%", marginTop: "6px" }}
            >
              {t("phone_change_number")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
