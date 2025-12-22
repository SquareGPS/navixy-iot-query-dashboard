# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import numpy as np
from typing import List, Dict, Any, Optional
import logging
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Navixy IoT Query Analytics Service",
    description="Python-based analytics service for Navixy IoT Query Dashboard",
    version="1.0.0"
)

# CORS middleware - configurable via environment variable
default_origins = ["http://localhost:8080", "http://localhost:3000", "http://localhost:8081"]
additional_origins = os.environ.get("CORS_ALLOWED_ORIGINS", "").split(",")
allowed_origins = default_origins + [o.strip() for o in additional_origins if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request/Response models
class AnalyticsRequest(BaseModel):
    data: List[Dict[str, Any]]
    analysis_type: str
    parameters: Optional[Dict[str, Any]] = {}

class AnalyticsResponse(BaseModel):
    success: bool
    result: Dict[str, Any]
    message: Optional[str] = None

class CorrelationRequest(BaseModel):
    data: List[Dict[str, Any]]
    columns: List[str]

class RegressionRequest(BaseModel):
    data: List[Dict[str, Any]]
    target_column: str
    feature_columns: List[str]

class ClusteringRequest(BaseModel):
    data: List[Dict[str, Any]]
    columns: List[str]
    n_clusters: int = 3

# Analytics Engine
class AnalyticsEngine:
    def __init__(self):
        self.pandas = pd
        self.numpy = np
    
    def correlation_analysis(self, data: List[Dict[str, Any]], columns: List[str]) -> Dict[str, Any]:
        """Perform correlation analysis on specified columns"""
        try:
            df = pd.DataFrame(data)
            
            # Select only numeric columns
            numeric_df = df[columns].select_dtypes(include=[np.number])
            
            if numeric_df.empty:
                raise ValueError("No numeric columns found for correlation analysis")
            
            correlation_matrix = numeric_df.corr()
            
            return {
                "correlation_matrix": correlation_matrix.to_dict(),
                "columns": numeric_df.columns.tolist(),
                "summary": {
                    "total_columns": len(numeric_df.columns),
                    "strong_correlations": self._find_strong_correlations(correlation_matrix)
                }
            }
        except Exception as e:
            logger.error(f"Correlation analysis error: {str(e)}")
            raise HTTPException(status_code=400, detail=str(e))
    
    def regression_analysis(self, data: List[Dict[str, Any]], target: str, features: List[str]) -> Dict[str, Any]:
        """Perform linear regression analysis"""
        try:
            from sklearn.linear_model import LinearRegression
            from sklearn.metrics import r2_score, mean_squared_error
            
            df = pd.DataFrame(data)
            
            # Prepare data
            X = df[features].select_dtypes(include=[np.number])
            y = df[target]
            
            if X.empty or y.isna().all():
                raise ValueError("Invalid data for regression analysis")
            
            # Handle missing values
            X = X.fillna(X.mean())
            y = y.fillna(y.mean())
            
            # Fit model
            model = LinearRegression()
            model.fit(X, y)
            
            # Predictions
            y_pred = model.predict(X)
            
            # Metrics
            r2 = r2_score(y, y_pred)
            mse = mean_squared_error(y, y_pred)
            
            return {
                "coefficients": dict(zip(X.columns, model.coef_)),
                "intercept": float(model.intercept_),
                "r_squared": float(r2),
                "mean_squared_error": float(mse),
                "feature_importance": dict(zip(X.columns, abs(model.coef_))),
                "predictions": y_pred.tolist()
            }
        except Exception as e:
            logger.error(f"Regression analysis error: {str(e)}")
            raise HTTPException(status_code=400, detail=str(e))
    
    def clustering_analysis(self, data: List[Dict[str, Any]], columns: List[str], n_clusters: int = 3) -> Dict[str, Any]:
        """Perform K-means clustering analysis"""
        try:
            from sklearn.cluster import KMeans
            from sklearn.preprocessing import StandardScaler
            
            df = pd.DataFrame(data)
            
            # Select numeric columns
            numeric_df = df[columns].select_dtypes(include=[np.number])
            
            if numeric_df.empty:
                raise ValueError("No numeric columns found for clustering")
            
            # Handle missing values
            numeric_df = numeric_df.fillna(numeric_df.mean())
            
            # Standardize features
            scaler = StandardScaler()
            scaled_data = scaler.fit_transform(numeric_df)
            
            # Perform clustering
            kmeans = KMeans(n_clusters=n_clusters, random_state=42)
            clusters = kmeans.fit_predict(scaled_data)
            
            # Add cluster labels to original data
            df_with_clusters = df.copy()
            df_with_clusters['cluster'] = clusters
            
            return {
                "clusters": clusters.tolist(),
                "cluster_centers": kmeans.cluster_centers_.tolist(),
                "inertia": float(kmeans.inertia_),
                "n_clusters": n_clusters,
                "cluster_summary": self._cluster_summary(df_with_clusters, numeric_df.columns.tolist())
            }
        except Exception as e:
            logger.error(f"Clustering analysis error: {str(e)}")
            raise HTTPException(status_code=400, detail=str(e))
    
    def statistical_summary(self, data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Generate comprehensive statistical summary"""
        try:
            df = pd.DataFrame(data)
            
            numeric_df = df.select_dtypes(include=[np.number])
            categorical_df = df.select_dtypes(include=['object'])
            
            summary = {
                "data_shape": df.shape,
                "numeric_summary": numeric_df.describe().to_dict() if not numeric_df.empty else {},
                "categorical_summary": {
                    col: {
                        "unique_count": df[col].nunique(),
                        "most_frequent": df[col].mode().iloc[0] if not df[col].mode().empty else None,
                        "missing_count": df[col].isna().sum()
                    } for col in categorical_df.columns
                },
                "missing_data": df.isna().sum().to_dict(),
                "data_types": df.dtypes.astype(str).to_dict()
            }
            
            return summary
        except Exception as e:
            logger.error(f"Statistical summary error: {str(e)}")
            raise HTTPException(status_code=400, detail=str(e))
    
    def _find_strong_correlations(self, corr_matrix: pd.DataFrame, threshold: float = 0.7) -> List[Dict[str, Any]]:
        """Find strong correlations above threshold"""
        strong_corrs = []
        for i in range(len(corr_matrix.columns)):
            for j in range(i+1, len(corr_matrix.columns)):
                corr_value = corr_matrix.iloc[i, j]
                if abs(corr_value) >= threshold:
                    strong_corrs.append({
                        "column1": corr_matrix.columns[i],
                        "column2": corr_matrix.columns[j],
                        "correlation": float(corr_value)
                    })
        return strong_corrs
    
    def _cluster_summary(self, df: pd.DataFrame, numeric_columns: List[str]) -> Dict[str, Any]:
        """Generate summary statistics for each cluster"""
        cluster_summary = {}
        for cluster_id in df['cluster'].unique():
            cluster_data = df[df['cluster'] == cluster_id]
            cluster_summary[f"cluster_{cluster_id}"] = {
                "size": len(cluster_data),
                "percentage": len(cluster_data) / len(df) * 100,
                "numeric_means": cluster_data[numeric_columns].mean().to_dict() if numeric_columns else {}
            }
        return cluster_summary

# Initialize analytics engine
analytics_engine = AnalyticsEngine()

# API Endpoints
@app.get("/")
async def root():
    return {"message": "SQL Report Analytics Service", "status": "running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "analytics"}

@app.post("/correlation", response_model=AnalyticsResponse)
async def correlation_analysis(request: CorrelationRequest):
    """Perform correlation analysis on specified columns"""
    try:
        result = analytics_engine.correlation_analysis(request.data, request.columns)
        return AnalyticsResponse(success=True, result=result)
    except Exception as e:
        return AnalyticsResponse(success=False, result={}, message=str(e))

@app.post("/regression", response_model=AnalyticsResponse)
async def regression_analysis(request: RegressionRequest):
    """Perform linear regression analysis"""
    try:
        result = analytics_engine.regression_analysis(
            request.data, 
            request.target_column, 
            request.feature_columns
        )
        return AnalyticsResponse(success=True, result=result)
    except Exception as e:
        return AnalyticsResponse(success=False, result={}, message=str(e))

@app.post("/clustering", response_model=AnalyticsResponse)
async def clustering_analysis(request: ClusteringRequest):
    """Perform K-means clustering analysis"""
    try:
        result = analytics_engine.clustering_analysis(
            request.data, 
            request.columns, 
            request.n_clusters
        )
        return AnalyticsResponse(success=True, result=result)
    except Exception as e:
        return AnalyticsResponse(success=False, result={}, message=str(e))

@app.post("/statistical-summary", response_model=AnalyticsResponse)
async def statistical_summary(data: List[Dict[str, Any]]):
    """Generate comprehensive statistical summary of the data"""
    try:
        result = analytics_engine.statistical_summary(data)
        return AnalyticsResponse(success=True, result=result)
    except Exception as e:
        return AnalyticsResponse(success=False, result={}, message=str(e))

@app.post("/analyze", response_model=AnalyticsResponse)
async def general_analysis(request: AnalyticsRequest):
    """General analysis endpoint that routes to specific analysis types"""
    try:
        analysis_type = request.analysis_type.lower()
        
        if analysis_type == "correlation":
            if not request.parameters.get("columns"):
                raise ValueError("Columns parameter required for correlation analysis")
            result = analytics_engine.correlation_analysis(
                request.data, 
                request.parameters["columns"]
            )
        elif analysis_type == "regression":
            if not request.parameters.get("target_column") or not request.parameters.get("feature_columns"):
                raise ValueError("target_column and feature_columns parameters required for regression")
            result = analytics_engine.regression_analysis(
                request.data,
                request.parameters["target_column"],
                request.parameters["feature_columns"]
            )
        elif analysis_type == "clustering":
            if not request.parameters.get("columns"):
                raise ValueError("Columns parameter required for clustering")
            result = analytics_engine.clustering_analysis(
                request.data,
                request.parameters["columns"],
                request.parameters.get("n_clusters", 3)
            )
        elif analysis_type == "summary":
            result = analytics_engine.statistical_summary(request.data)
        else:
            raise ValueError(f"Unknown analysis type: {analysis_type}")
        
        return AnalyticsResponse(success=True, result=result)
    except Exception as e:
        return AnalyticsResponse(success=False, result={}, message=str(e))

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("ANALYTICS_PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)

