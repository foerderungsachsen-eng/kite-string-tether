import React from 'react';
import { useParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';

export default function ExecuteWebhook() {
  const { webhookId } = useParams<{ webhookId: string }>();

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Execute Webhook</h1>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600">
            Webhook ID: {webhookId || 'Not specified'}
          </p>
        </div>
      </div>
    </Layout>
  );
}