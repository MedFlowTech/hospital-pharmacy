# SPEC-1-Pharmacy Module

## Background
Your hospital needs a dedicated, mobile-friendly Pharmacy system that can later plug into the overall HMS. This Pharmacy module will empower staff to manage products, customers, suppliers, purchases, sales, returns, expenses, reporting and user administration through a clean, responsive UI similar to the example at private-pharm.com/items.

## High-Level Scope
We will deliver the following major areas in v1:

1. **Dashboard**  
   - Summary KPIs (e.g. daily sales, stock alerts, expiring batches)

2. **Sales**  
   - Point-of-Sale interface (new sale)  
   - Sales list, returns (new and list)  

3. **Customers**  
   - Add new customer, view/search list, bulk import  

4. **Purchases**  
   - Record new purchase, view list, returns (new and list)  

5. **Suppliers**  
   - Add new supplier, view/search list, bulk import  

6. **Items**  
   - CRUD items, categories, brands  
   - Print barcode/price labels, bulk import  

7. **Expenses**  
   - Record new expense, view/search list, manage expense categories  

8. **Reporting**  
   - Profit & Loss, Purchase, Purchase Returns, Purchase Payments  
   - Item Sales/Purchase, Sales, Sales Returns, Sales Payments  
   - Stock, Expense, Expired Items  

9. **Users & Roles**  
   - Create users, assign roles, view users list, roles list  

10. **SMS Notifications**  
    - Send SMS, manage templates, integrate SMS API  

11. **Settings**  
    - Company profile, site settings, tax, units, payment types, currencies  
    - Change password  
## Requirements

### Must Have (M)
- **Responsive Web UI**: Fully mobile-friendly, professional look matching the reference  
- **Authentication & Security**  
  - Secure login (HTTPS, password hashing)  
  - Role-based access control (pharmacist, assistant, admin)  
- **Dashboard**: Real-time KPIs (daily sales, low-stock alerts, expiring batches)  
- **Sales**  
  - POS interface for new sales (scan/search items, apply discounts, select customer)  
  - Sales list with search/filter and ability to view/details  
  - New sales return & returns list  
- **Customers**: CRUD, search/filter, bulk import (CSV)  
- **Supases**: CRUD, search/filter, bulk import (CSV)  
- **Purchases**  
  - New purchase entry (batch, expiry date tracking)  
  - Purchase list with search/filter  
  - New purchase return & returns list  
- **Items**  
  - CRUD for items, categories, brands  
  - Print barcode/price labels  
  - Bulk import (CSV)  
- **Expenses**: CRUD expenses & categories, list with search/filter  
- **Reporting** (view & export CSV/PDF)  
  - Profit & Loss, Purchase, Purchase Returns, Purchase Payments  
  - Item Sales, Item Purchase, Sales, Sales Returns, Sales Payments  
  - Stock, Expense, Expired Items  
- **Users & Roles**: Create/manage users, assign roles, view lists  
- **SMS Notifications**: Send SMS, manage templates, integrate with SMS API  
- **Settings**: Company profile, site settings, tax rates, units, payment types, currencies, change password  
- **API Layer**: RESTful endpoints for all major entities to enable future HMS integration  

### Should Have (S)
- **Search & Filters** on all lists (date ranges, status, supplier/customer)  
- **Bulk Actions** (delete, update status) on lists  
- **Audit Logging** of key actions (sales, purchases, settings changes)  
- **Report Export** to PDF in addition to CSV  
- **Expiry Alerts** via in-app notifications or email  

### Could Have (C)
- **Offline-Capable Sales** (cache sales locally when offline)  
- **Multi-language Support** (i18n)  
- **Multi-currency Pricing** and on-the-fly conversions  
- **Basic Analytics Dashboard** (charts for trends)  

### Won’t Have in v1 (W)
- **Insurance Claims Processing** (deferred to HMS integration)  
- **Native Mobile Apps** (web-only responsive)  
- **Advanced Predictive Analytics** (beyond basic reports)  
- **Integration with External E-prescribing Networks**  

### Non-Functional Requirements
- **Performance**: Page load under 2s for 5,000 items dataset  
- **Scalability**: Design for 50 concurrent users  
- **Security & Compliance**: HTTPS, GDPR-ready data handling  
- **Maintainability**: Modular codebase, well-documented REST API  
