# 🛡️ Guardianes Arquitectónicos: Entendiendo el Semáforo de Calidad

## ¿Por qué mi Pull Request está bloqueado?
En esta plataforma, la velocidad nunca justifica la deuda invisible. Utilizamos un **Agente Guardián** que analiza tu código en busca de "Olores Arquitectónicos" (Architectural Smells) antes de permitir la fusión.

Si ves el semáforo en **🔴 ROJO**, significa que has introducido un riesgo estructural grave.

## La Fórmula del Coste (ATDI)
No adivinamos la calidad; la calculamos. Usamos el **Índice de Deuda Técnica Arquitectónica (ATDI)** basado en la investigación de Sas & Avgeriou:

> **ATDI = Σ (Severidad × Tamaño del Olor)**

### Caso de Estudio Real: "El Sabotaje Controlado"
Durante la fase de construcción, realizamos una prueba inyectando una dependencia cíclica entre dos archivos (`bad_module_a.ts` <-> `bad_module_b.ts`).

*   **Detección:** El sistema identificó el ciclo inmediatamente.
*   **Cálculo:** Asignó una severidad máxima de 10 (debido al bloqueo de modularidad).
*   **Resultado:** 10 (Severidad) x 2 (Archivos) = **ATDI Score de 20**.

**¿Qué significa un Score de 20?**
Significa que el esfuerzo futuro para mantener ese código es **20 unidades mayor** que el de un código limpio. Si apruebas este PR, estás firmando un pagaré de tiempo futuro que tu equipo tendrá que pagar con intereses.

## Tu Responsabilidad (Zona de Deformación Moral)
Si el semáforo está en **🟡 ÁMBAR** (Riesgo Moderado), puedes proceder, pero el sistema exigirá tu **Firma Criptográfica** y una justificación escrita.
*   Esto asegura que la IA no toma la decisión final.
*   Tú, como humano **Accountable (A)**, asumes la responsabilidad legal y técnica de esa deuda.

---
*Referencia: Sas, D., Avgeriou, P., et al. "An architectural technical debt index based on machine learning and architectural smells".*
