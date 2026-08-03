package com.dong.commandapi.testsupport;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.ECDSASigner;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jose.jwk.Curve;
import com.nimbusds.jose.jwk.ECKey;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.gen.ECKeyGenerator;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.SecurityContext;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.PlainJWT;
import com.nimbusds.jwt.SignedJWT;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.Date;

/**
 * Test-only stand-in for Supabase's published JWKS endpoint. {@code
 * SupabaseJwtFilter} verifies against whatever {@code JWKSource} bean is in
 * the context; {@link TestJwksConfig} overrides the production one (which
 * fetches over the network) with an in-memory key set built from the same
 * key pair {@link #signedJwt} signs with, so tests never touch the network.
 */
public final class JwksTestSupport {

    /** The key the fake JWKS endpoint publishes — the only one that should verify. */
    private static final ECKey KEY_PAIR = generate("test-key");
    /**
     * A key the fake JWKS endpoint does <em>not</em> publish, used to prove a token
     * is rejected on its signature rather than on some incidental malformation.
     */
    private static final ECKey FOREIGN_KEY_PAIR = generate("test-key");

    private JwksTestSupport() {
    }

    private static ECKey generate(String keyId) {
        try {
            return new ECKeyGenerator(Curve.P_256).keyID(keyId).generate();
        } catch (JOSEException ex) {
            throw new IllegalStateException(ex);
        }
    }

    /** Signs a JWT with the published key pair — the shape a real Supabase-issued token has. */
    public static String signedJwt(String subject, String role, Instant expiry) {
        return sign(KEY_PAIR, subject, role, expiry);
    }

    /**
     * Signs a structurally perfect JWT with an unpublished key, reusing the published
     * key's {@code kid} so the key set still resolves a candidate key and the token
     * fails specifically at signature verification.
     */
    public static String forgedJwt(String subject, String role, Instant expiry) {
        return sign(FOREIGN_KEY_PAIR, subject, role, expiry);
    }

    /**
     * A token signed HS256 using the published <em>public</em> key material as the
     * shared secret — the classic algorithm-confusion forgery. Public keys are public,
     * so if the verifier ever accepted HS256 anyone could mint valid tokens. Rejecting
     * this is the core security property of the move off the legacy shared secret.
     */
    public static String hs256ConfusionJwt(String subject, String role, Instant expiry) {
        try {
            byte[] publicKeyMaterial = KEY_PAIR.toPublicJWK().toJSONString()
                    .getBytes(StandardCharsets.UTF_8);
            byte[] secret = MessageDigest.getInstance("SHA-256").digest(publicKeyMaterial);
            SignedJWT jwt = new SignedJWT(
                    new JWSHeader.Builder(JWSAlgorithm.HS256).keyID(KEY_PAIR.getKeyID()).build(),
                    claims(subject, role, expiry));
            jwt.sign(new MACSigner(secret));
            return jwt.serialize();
        } catch (JOSEException | NoSuchAlgorithmException ex) {
            throw new IllegalStateException(ex);
        }
    }

    /** An unsecured ({@code alg=none}) token carrying otherwise acceptable claims. */
    public static String unsecuredJwt(String subject, String role, Instant expiry) {
        return new PlainJWT(claims(subject, role, expiry)).serialize();
    }

    /** Correctly signed, but with no {@code exp} claim at all — must not be treated as eternal. */
    public static String signedJwtWithoutExpiry(String subject, String role) {
        try {
            SignedJWT jwt = new SignedJWT(
                    new JWSHeader.Builder(JWSAlgorithm.ES256).keyID(KEY_PAIR.getKeyID()).build(),
                    new JWTClaimsSet.Builder().subject(subject).claim("role", role).build());
            jwt.sign(new ECDSASigner(KEY_PAIR));
            return jwt.serialize();
        } catch (JOSEException ex) {
            throw new IllegalStateException(ex);
        }
    }

    private static JWTClaimsSet claims(String subject, String role, Instant expiry) {
        return new JWTClaimsSet.Builder()
                .subject(subject)
                .claim("role", role)
                .expirationTime(Date.from(expiry))
                .build();
    }

    private static String sign(ECKey key, String subject, String role, Instant expiry) {
        try {
            JWTClaimsSet claims = new JWTClaimsSet.Builder()
                    .subject(subject)
                    .claim("role", role)
                    .expirationTime(Date.from(expiry))
                    .build();
            SignedJWT jwt = new SignedJWT(
                    new JWSHeader.Builder(JWSAlgorithm.ES256).keyID(key.getKeyID()).build(),
                    claims);
            jwt.sign(new ECDSASigner(key));
            return jwt.serialize();
        } catch (JOSEException ex) {
            throw new IllegalStateException(ex);
        }
    }

    /**
     * Corrupts a token's signature in place, preserving its length.
     *
     * <p>Mutates a character in the <em>middle</em> of the signature segment. Nibbling
     * the last character instead would be an unreliable test: an ES256 signature is
     * 64 bytes encoded as 86 base64url characters, so the final character carries
     * only two significant bits and four bits of padding — swapping it decodes to
     * byte-identical output roughly a quarter of the time, and the token would still
     * verify.
     */
    public static String withCorruptedSignature(String token) {
        int lastDot = token.lastIndexOf('.');
        String signature = token.substring(lastDot + 1);
        int mid = signature.length() / 2;
        char original = signature.charAt(mid);
        char replacement = original == 'A' ? 'B' : 'A';
        return token.substring(0, lastDot + 1)
                + signature.substring(0, mid) + replacement + signature.substring(mid + 1);
    }

    @TestConfiguration
    public static class TestJwksConfig {

        @Bean
        @Primary
        public JWKSource<SecurityContext> testSupabaseJwkSource() {
            return new ImmutableJWKSet<>(new JWKSet(KEY_PAIR.toPublicJWK()));
        }
    }
}
